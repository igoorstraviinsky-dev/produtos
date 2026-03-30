import { AppEnv } from "../../config/env";
import { ControlPlaneRepository } from "../../lib/postgres";
import { ProductGateway, ProductRecord } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import { calculateProductCost } from "./cost-calculator";
import {
  ProductMediaAssetRecord,
  buildStableProductMediaUrl
} from "../media/media.service";
import { attachVariantMetrics, buildVariantMetrics } from "./variant-metrics";

type UpdateInventoryProductInput = {
  id: string;
  sku: string;
  name: string;
  availableQuantity: number;
};

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export class ProductsAdminService {
  constructor(
    private readonly env: Pick<AppEnv, "PUBLIC_BASE_URL">,
    private readonly productGateway: ProductGateway,
    private readonly productCache: ProductCacheStore,
    private readonly controlPlane: ControlPlaneRepository
  ) {}

  private async syncMasterCatalogFromUpstream(products: Awaited<ReturnType<ProductGateway["listProducts"]>>) {
    const syncedProducts = await this.controlPlane.replaceMasterProducts(
      products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        masterStock: product.availableQuantity,
        updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date(),
        variants: product.variants.map((variant) => ({
          id: variant.variant_id,
          productId: product.id,
          sku: variant.sku,
          individualWeight: toNullableNumber(variant.individual_weight),
          individualStock: variant.individual_stock,
          createdAt: variant.created_at ? new Date(variant.created_at) : undefined,
          updatedAt: variant.updated_at ? new Date(variant.updated_at) : new Date()
        }))
      }))
    );

    await this.productCache.delete(buildProductsCacheKey());
    return syncedProducts;
  }

  async syncMasterCatalog() {
    const products = await this.productGateway.listProducts();
    const syncedProducts = await this.syncMasterCatalogFromUpstream(products);

    return {
      data: {
        syncedCount: syncedProducts.length,
        updatedAt: new Date().toISOString()
      }
    };
  }

  async listProducts(companyId?: string) {
    const [products, costSettings] = await Promise.all([
      this.productGateway.listProducts(),
      this.controlPlane.getCostSettings(companyId)
    ]);

    await this.syncMasterCatalogFromUpstream(products);

    return products.map((product) => {
      const costBreakdown = calculateProductCost(product, costSettings);
      return {
        ...this.enrichProduct(product, costBreakdown.finalCost),
        costFinal: costBreakdown.finalCost,
        costBreakdown
      };
    });
  }

  async updateProduct(input: UpdateInventoryProductInput, companyId?: string) {
    await this.productGateway.updateProduct(input);
    const allProducts = await this.productGateway.listProducts();
    await this.syncMasterCatalogFromUpstream(allProducts);
    const product = allProducts.find((item) => item.id === input.id);

    if (!product) {
      throw new Error("Updated product not found after upstream sync");
    }

    const costSettings = await this.controlPlane.getCostSettings(companyId);
    const costBreakdown = calculateProductCost(product, costSettings);

    return {
      ...this.enrichProduct(product, costBreakdown.finalCost),
      costFinal: costBreakdown.finalCost,
      costBreakdown
    };
  }

  private enrichProduct(product: ProductRecord, productCostFinal: number | null) {
    const mediaAssets = this.buildMediaAssets(product);
    const mediaUrls = [
      ...new Set(mediaAssets.map((asset) => asset.url).filter((url): url is string => Boolean(url)))
    ];
    const mainImageUrl = mediaUrls[0] ?? null;

    return {
      ...product,
      media_assets: mediaAssets,
      mediaAssets,
      media_urls: mediaUrls,
      mediaUrls,
      main_image_url: mainImageUrl,
      mainImageUrl,
      variants: (product.variants ?? []).map((variant) =>
        attachVariantMetrics(
          variant,
          buildVariantMetrics({
            individualWeight: variant.individual_weight ?? variant.individualWeight,
            stockWeightGrams: variant.individual_stock ?? variant.individualStock,
            productCostFinal
          })
        )
      )
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
      url: buildStableProductMediaUrl(asset.storage_key, this.env)
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
