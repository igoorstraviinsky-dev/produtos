import { FastifyBaseLogger } from "fastify";

import { AppEnv } from "../../config/env";
import { ControlPlaneRepository } from "../../lib/postgres";
import { ProductGateway, ProductRecord } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { AppError } from "../../middleware/error-handler";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import {
  ProductMediaAssetRecord,
  buildStableProductMediaUrl
} from "../media/media.service";
import { ProductsResponse } from "./products.schemas";
import { calculateProductCost } from "./cost-calculator";

type ProductCacheEntry = {
  cachedAt: string;
  data: ProductRecord[];
};

type ProductsServiceOptions = {
  env: AppEnv;
  cacheStore: ProductCacheStore;
  productGateway: ProductGateway;
  controlPlane: ControlPlaneRepository;
  logger?: FastifyBaseLogger;
};

export class ProductsService {
  constructor(private readonly options: ProductsServiceOptions) {}

  async listProducts(): Promise<ProductsResponse> {
    const cacheKey = buildProductsCacheKey();
    const now = Date.now();
    const cachedEntry = await this.options.cacheStore.get<ProductCacheEntry>(cacheKey);
    const costSettings = await this.options.controlPlane.getCostSettings();

    if (cachedEntry && this.isFresh(cachedEntry, now)) {
      this.options.logger?.info(
        {
          cacheKey
        },
        "serving products from fresh cache"
      );
      return {
        data: cachedEntry.data.map((product) => this.enrichProduct(product, costSettings)),
        meta: {
          source: "cache",
          count: cachedEntry.data.length
        }
      };
    }

    try {
      const products = await this.options.productGateway.listProducts();
      await this.options.cacheStore.set<ProductCacheEntry>(
        cacheKey,
        {
          cachedAt: new Date(now).toISOString(),
          data: products
        },
        this.options.env.PRODUCTS_CACHE_TTL_SECONDS + this.options.env.PRODUCTS_CACHE_STALE_SECONDS
      );
      this.options.logger?.info(
        {
          cacheKey,
          count: products.length
        },
        "fetched products from upstream and refreshed cache"
      );

      return {
        data: products.map((product) => this.enrichProduct(product, costSettings)),
        meta: {
          source: "upstream",
          count: products.length
        }
      };
    } catch (error) {
      if (cachedEntry && this.isServeableStale(cachedEntry, now)) {
        this.options.logger?.warn(
          {
            cacheKey,
            cause: error instanceof Error ? error.message : "unknown"
          },
          "serving stale products cache after upstream failure"
        );
        return {
          data: cachedEntry.data.map((product) => this.enrichProduct(product, costSettings)),
          meta: {
            source: "cache",
            stale: true,
            count: cachedEntry.data.length
          }
        };
      }

      this.options.logger?.error(
        {
          cacheKey,
          cause: error instanceof Error ? error.message : "unknown"
        },
        "products upstream unavailable and no cache could be served"
      );
      throw new AppError(503, "PRODUCTS_SOURCE_UNAVAILABLE", "Product catalog is unavailable", {
        cause: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  private isFresh(entry: ProductCacheEntry, now: number) {
    return now - Date.parse(entry.cachedAt) <= this.options.env.PRODUCTS_CACHE_TTL_SECONDS * 1000;
  }

  private isServeableStale(entry: ProductCacheEntry, now: number) {
    return (
      now - Date.parse(entry.cachedAt) <=
      (this.options.env.PRODUCTS_CACHE_TTL_SECONDS +
        this.options.env.PRODUCTS_CACHE_STALE_SECONDS) *
        1000
    );
  }

  private enrichProduct(product: ProductRecord, costSettings: Awaited<ReturnType<ControlPlaneRepository["getCostSettings"]>>) {
    const costBreakdown = calculateProductCost(product, costSettings);
    const mediaAssets = this.buildMediaAssets(product);
    const mediaUrls = [...new Set(mediaAssets.map((asset) => asset.url).filter((url): url is string => Boolean(url)))];
    const mainImageUrl = mediaUrls[0] ?? null;

    return {
      ...product,
      media_assets: mediaAssets,
      mediaAssets,
      media_urls: mediaUrls,
      mediaUrls,
      main_image_url: mainImageUrl,
      mainImageUrl,
      costFinal: costBreakdown.finalCost,
      costBreakdown
    };
  }

  private buildMediaAssets(product: ProductRecord) {
    const upstreamAssets = [...(product.media_assets ?? product.mediaAssets ?? [])];

    if (upstreamAssets.length > 0) {
      return upstreamAssets.map((asset) => this.attachStableMediaUrl(asset));
    }

    const fallbackAssets = this.buildFallbackMediaAssets(product);
    return fallbackAssets.map((asset) => this.attachStableMediaUrl(asset));
  }

  private attachStableMediaUrl(asset: ProductMediaAssetRecord): ProductMediaAssetRecord {
    return {
      ...asset,
      url: buildStableProductMediaUrl(asset.storage_key, this.options.env)
    };
  }

  private buildFallbackMediaAssets(product: ProductRecord): ProductMediaAssetRecord[] {
    const assetCandidates: Array<{
      role: string;
      storageKey: string | null | undefined;
    }> = [
      {
        role: "bronze",
        storageKey: product.s3_key_bronze ?? product.bronzeImageKey
      },
      {
        role: "silver",
        storageKey: product.s3_key_silver ?? product.silverImageKey
      }
    ];

    return assetCandidates
      .filter((candidate): candidate is { role: string; storageKey: string } => Boolean(candidate.storageKey))
      .map((candidate, index) => ({
        id: `${product.id}:${candidate.role}`,
        role: candidate.role,
        storage_key: candidate.storageKey,
        storageKey: candidate.storageKey,
        sort_order: index,
        sortOrder: index,
        url: null,
        created_at: product.created_at ?? null,
        createdAt: product.createdAt ?? null
      }));
  }
}
