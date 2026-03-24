import { FastifyBaseLogger } from "fastify";

import { AppEnv } from "../../config/env";
import { ProductGateway, ProductRecord } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { AppError } from "../../middleware/error-handler";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import { ProductsResponse } from "./products.schemas";

type ProductCacheEntry = {
  cachedAt: string;
  data: ProductRecord[];
};

type ProductsServiceOptions = {
  env: AppEnv;
  cacheStore: ProductCacheStore;
  productGateway: ProductGateway;
  logger?: FastifyBaseLogger;
};

export class ProductsService {
  constructor(private readonly options: ProductsServiceOptions) {}

  async listProducts(): Promise<ProductsResponse> {
    const cacheKey = buildProductsCacheKey();
    const now = Date.now();
    const cachedEntry = await this.options.cacheStore.get<ProductCacheEntry>(cacheKey);

    if (cachedEntry && this.isFresh(cachedEntry, now)) {
      this.options.logger?.info(
        {
          cacheKey
        },
        "serving products from fresh cache"
      );
      return {
        data: cachedEntry.data,
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
        data: products,
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
          data: cachedEntry.data,
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
}
