import { FastifyBaseLogger } from "fastify";

import { AppEnv } from "../../config/env";
import {
  ControlPlaneRepository,
  EffectiveInventoryRecord
} from "../../lib/postgres";
import { ProductGateway, ProductRecord } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { CostSettingsCache } from "../../lib/cost-settings-cache";
import { AppError } from "../../middleware/error-handler";
import {
  buildCompanyCatalogCacheKey,
  buildProductsCacheKey,
  buildProductsMetaCacheKey,
  buildProductsResponseCacheKey
} from "../../utils/cache-keys";
import { AuthContext } from "../auth/auth.types";
import {
  ProductMediaAssetRecord,
  buildStableProductMediaUrl
} from "../media/media.service";
import { CompanyCatalogResponse, ProductsResponse } from "./products.schemas";
import { calculateProductCost } from "./cost-calculator";
import { attachVariantMetrics, buildVariantMetrics } from "./variant-metrics";

type ProductCacheEntry = {
  cachedAt: string;
  data: ProductRecord[];
};

type CatalogMetaCacheEntry = {
  cachedAt: string;
  laborRateTables: Awaited<ReturnType<ProductGateway["listLaborRateTables"]>>;
  productTypes: Awaited<ReturnType<ProductGateway["listProductTypes"]>>;
  materialTypes: Array<
    Awaited<ReturnType<ProductGateway["listProductTypes"]>>[number] & {
      laborRateTables: Awaited<ReturnType<ProductGateway["listLaborRateTables"]>>;
    }
  >;
};

type ProductListMeta = {
  source: "cache" | "upstream";
  stale?: boolean;
  count: number;
};

type CompanyCatalogContext = Pick<
  AuthContext,
  | "companyId"
  | "companyExternalCode"
  | "companyName"
  | "companyIsActive"
  | "companySyncStoreInventory"
  | "companyApiKeyCount"
  | "companyActiveKeyCount"
  | "companyCreatedAt"
  | "companyUpdatedAt"
>;
type ProductFilters = {
  laborRateTableId?: string;
  laborRateId?: string;
};

type ProductsServiceOptions = {
  env: AppEnv;
  cacheStore: ProductCacheStore;
  productGateway: ProductGateway;
  controlPlane: ControlPlaneRepository;
  costSettingsCache?: CostSettingsCache;
  logger?: FastifyBaseLogger;
};

export class ProductsService {
  private rawProductsInFlight: Promise<{ products: ProductRecord[]; meta: ProductListMeta }> | null =
    null;
  private catalogMetaInFlight: Promise<CatalogMetaCacheEntry> | null = null;

  constructor(private readonly options: ProductsServiceOptions) {}

  async listProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
    const responseCacheKey = buildProductsResponseCacheKey(filters);
    const cachedResponse = await this.options.cacheStore.get<ProductsResponse>(responseCacheKey);
    if (cachedResponse) {
      this.options.logger?.debug({ responseCacheKey }, "serving products response from cache");
      return {
        ...cachedResponse,
        meta: {
          ...cachedResponse.meta,
          source: "cache"
        }
      };
    }

    const [{ products, meta }, costSettings, catalogMeta] = await Promise.all([
      this.listRawProducts(),
      this.options.costSettingsCache
        ? this.options.costSettingsCache.resolve()
        : this.options.controlPlane.getCostSettings(),
      this.loadCatalogMeta()
    ]);
    const filteredProducts = this.applyFilters(products, filters);

    const response = {
      data: filteredProducts.map((product) => this.enrichProduct(product, costSettings)),
      meta: {
        ...meta,
        count: filteredProducts.length,
        laborRateTables: catalogMeta.laborRateTables,
        materialTypes: catalogMeta.materialTypes
      }
    };

    await this.options.cacheStore.set(
      responseCacheKey,
      response,
      this.buildResponseCacheTtlSeconds(15)
    );

    return response;
  }

  async listCompanyCatalog(
    companyContext: CompanyCatalogContext,
    filters: ProductFilters = {}
  ): Promise<CompanyCatalogResponse> {
    const responseCacheKey = buildCompanyCatalogCacheKey(companyContext.companyId, filters);
    const cachedResponse = await this.options.cacheStore.get<CompanyCatalogResponse>(
      responseCacheKey
    );
    if (cachedResponse) {
      this.options.logger?.debug(
        { responseCacheKey, companyId: companyContext.companyId },
        "serving company catalog response from cache"
      );
      return {
        ...cachedResponse,
        meta: {
          ...cachedResponse.meta,
          source: "cache"
        }
      };
    }

    const [{ products, meta }, costSettings, effectiveInventory, catalogMeta] = await Promise.all([
      this.listRawProducts(),
      this.options.costSettingsCache
        ? this.options.costSettingsCache.resolve(companyContext.companyId)
        : this.options.controlPlane.getCostSettings(companyContext.companyId),
      this.options.controlPlane.listEffectiveInventoryByCompany(companyContext.companyId),
      this.loadCatalogMeta()
    ]);
    const filteredProducts = this.applyFilters(products, filters);
    const inventoryByProductId = new Map(
      effectiveInventory.map((item) => [item.productId, item] as const)
    );

    const response = {
      company: this.buildCompanyPayload(companyContext),
      data: filteredProducts.map((product) =>
        this.enrichCompanyProduct(
          product,
          costSettings,
          inventoryByProductId.get(product.id) ?? null
        )
      ),
      meta: {
        ...meta,
        count: filteredProducts.length,
        companyId: companyContext.companyId,
        companyExternalCode: companyContext.companyExternalCode,
        companyName: companyContext.companyName,
        laborRateTables: catalogMeta.laborRateTables,
        materialTypes: catalogMeta.materialTypes
      }
    };

    await this.options.cacheStore.set(
      responseCacheKey,
      response,
      this.buildResponseCacheTtlSeconds(5)
    );

    return response;
  }

  private buildResponseCacheTtlSeconds(maxTtlSeconds: number) {
    return Math.max(1, Math.min(this.options.env.PRODUCTS_CACHE_TTL_SECONDS, maxTtlSeconds));
  }

  private buildMaterialTypes(
    productTypes: Awaited<ReturnType<ProductGateway["listProductTypes"]>>,
    laborRateTables: Awaited<ReturnType<ProductGateway["listLaborRateTables"]>>
  ) {
    const laborRateTablesByMaterialTypeId = new Map<string, typeof laborRateTables>();

    for (const laborRateTable of laborRateTables) {
      const materialTypeId = laborRateTable.materialTypeId ?? laborRateTable.material_type_id;
      if (!materialTypeId) {
        continue;
      }

      const existing = laborRateTablesByMaterialTypeId.get(materialTypeId) ?? [];
      existing.push(laborRateTable);
      laborRateTablesByMaterialTypeId.set(materialTypeId, existing);
    }

    return productTypes.map((productType) => ({
      ...productType,
      laborRateTables: (laborRateTablesByMaterialTypeId.get(productType.id) ?? []).sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" })
      )
    }));
  }

  private applyFilters(products: ProductRecord[], filters: ProductFilters) {
    return products.filter((product) => {
      if (filters.laborRateTableId) {
        const laborRateTableId = product.laborRateTableId ?? product.labor_rate_table_id ?? null;
        if (laborRateTableId !== filters.laborRateTableId) {
          return false;
        }
      }

      if (filters.laborRateId) {
        const laborRateId = product.laborRateId ?? product.labor_rate_id ?? null;
        if (laborRateId !== filters.laborRateId) {
          return false;
        }
      }

      return true;
    });
  }

  private async listRawProducts(): Promise<{ products: ProductRecord[]; meta: ProductListMeta }> {
    const cacheKey = buildProductsCacheKey();
    const now = Date.now();
    const cachedEntry = await this.options.cacheStore.get<ProductCacheEntry>(cacheKey);

    if (cachedEntry && this.isFresh(cachedEntry, now)) {
      this.options.logger?.debug(
        {
          cacheKey
        },
        "serving products from fresh cache"
      );
      return {
        products: cachedEntry.data,
        meta: {
          source: "cache",
          count: cachedEntry.data.length
        }
      };
    }

    if (!this.rawProductsInFlight) {
      this.rawProductsInFlight = (async () => {
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
            products,
            meta: {
              source: "upstream" as const,
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
              products: cachedEntry.data,
              meta: {
                source: "cache" as const,
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
        } finally {
          this.rawProductsInFlight = null;
        }
      })();
    }

    return this.rawProductsInFlight;
  }

  private async loadCatalogMeta(): Promise<CatalogMetaCacheEntry> {
    const cacheKey = buildProductsMetaCacheKey();
    const now = Date.now();
    const cachedEntry = await this.options.cacheStore.get<CatalogMetaCacheEntry>(cacheKey);

    if (cachedEntry && this.isFresh(cachedEntry, now)) {
      this.options.logger?.debug(
        {
          cacheKey
        },
        "serving catalog metadata from fresh cache"
      );
      return {
        ...cachedEntry,
        materialTypes:
          cachedEntry.materialTypes ??
          this.buildMaterialTypes(cachedEntry.productTypes, cachedEntry.laborRateTables)
      };
    }

    if (!this.catalogMetaInFlight) {
      this.catalogMetaInFlight = (async () => {
        try {
          const [laborRateTables, productTypes] = await Promise.all([
            this.options.productGateway.listLaborRateTables(),
            this.options.productGateway.listProductTypes()
          ]);
          const entry = {
            cachedAt: new Date(now).toISOString(),
            laborRateTables,
            productTypes,
            materialTypes: this.buildMaterialTypes(productTypes, laborRateTables)
          };
          await this.options.cacheStore.set<CatalogMetaCacheEntry>(
            cacheKey,
            entry,
            this.options.env.PRODUCTS_CACHE_TTL_SECONDS + this.options.env.PRODUCTS_CACHE_STALE_SECONDS
          );
          this.options.logger?.info(
            {
              cacheKey,
              laborRateTables: laborRateTables.length,
              productTypes: productTypes.length
            },
            "fetched catalog metadata from upstream and refreshed cache"
          );
          return entry;
        } catch (error) {
          if (cachedEntry && this.isServeableStale(cachedEntry, now)) {
            this.options.logger?.warn(
              {
                cacheKey,
                cause: error instanceof Error ? error.message : "unknown"
              },
              "serving stale catalog metadata cache after upstream failure"
            );
            return cachedEntry;
          }

          this.options.logger?.error(
            {
              cacheKey,
              cause: error instanceof Error ? error.message : "unknown"
            },
            "catalog metadata upstream unavailable and no cache could be served"
          );
          throw new AppError(503, "PRODUCTS_SOURCE_UNAVAILABLE", "Product metadata is unavailable", {
            cause: error instanceof Error ? error.message : "unknown"
          });
        } finally {
          this.catalogMetaInFlight = null;
        }
      })();
    }

    return this.catalogMetaInFlight;
  }

  private isFresh(entry: { cachedAt: string }, now: number) {
    return now - Date.parse(entry.cachedAt) <= this.options.env.PRODUCTS_CACHE_TTL_SECONDS * 1000;
  }

  private isServeableStale(entry: { cachedAt: string }, now: number) {
    return (
      now - Date.parse(entry.cachedAt) <=
      (this.options.env.PRODUCTS_CACHE_TTL_SECONDS +
        this.options.env.PRODUCTS_CACHE_STALE_SECONDS) *
        1000
    );
  }

  private enrichProduct(
    product: ProductRecord,
    costSettings: Awaited<ReturnType<ControlPlaneRepository["getCostSettings"]>>
  ) {
    const costBreakdown = calculateProductCost(product, costSettings);
    const mediaAssets = this.buildMediaAssets(product);
    const mediaUrls = [
      ...new Set(mediaAssets.map((asset) => asset.url).filter((url): url is string => Boolean(url)))
    ];
    const mainImageUrl = mediaUrls[0] ?? null;
    const variants = (product.variants ?? []).map((variant) =>
      attachVariantMetrics(
        variant,
        buildVariantMetrics({
          individualWeight: variant.individual_weight ?? variant.individualWeight,
          stockWeightGrams: variant.individual_stock ?? variant.individualStock,
          productCostFinal: costBreakdown.finalCost
        })
      )
    );

    return {
      ...product,
      variant_count: variants.length,
      variantCount: variants.length,
      variants,
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

  private enrichCompanyProduct(
    product: ProductRecord,
    costSettings: Awaited<ReturnType<ControlPlaneRepository["getCostSettings"]>>,
    inventory: EffectiveInventoryRecord | null
  ) {
    const costBreakdown = calculateProductCost(product, costSettings);
    const mediaAssets = this.buildMediaAssets(product);
    const mediaUrls = [
      ...new Set(mediaAssets.map((asset) => asset.url).filter((url): url is string => Boolean(url)))
    ];
    const mainImageUrl = mediaUrls[0] ?? null;
    const inventoryVariantById = new Map(
      (inventory?.variants ?? []).map((variant) => [variant.variantId, variant] as const)
    );
    const variants = (product.variants ?? []).map((variant) => {
      const inventoryVariant =
        inventoryVariantById.get(variant.variant_id ?? variant.variantId) ??
        (inventory?.variants ?? []).find((item) => item.sku === variant.sku) ??
        null;
      const masterStock = variant.individual_stock ?? variant.individualStock ?? 0;
      const customStockQuantity = inventoryVariant?.customStockQuantity ?? null;
      const effectiveStockQuantity = inventoryVariant?.effectiveStockQuantity ?? masterStock;
      const variantMetrics = buildVariantMetrics({
        individualWeight: variant.individual_weight ?? variant.individualWeight,
        stockWeightGrams: effectiveStockQuantity,
        productCostFinal: costBreakdown.finalCost
      });

      return {
        ...attachVariantMetrics(
          {
            ...variant,
            individual_stock: effectiveStockQuantity,
            individualStock: effectiveStockQuantity
          },
          variantMetrics
        ),
        master_stock: masterStock,
        masterStock,
        custom_stock_quantity: customStockQuantity,
        customStockQuantity,
        effective_stock_quantity: effectiveStockQuantity,
        effectiveStockQuantity
      };
    });
    const masterStock =
      variants.length > 0
        ? variants.reduce((sum, variant) => sum + variant.masterStock, 0)
        : product.available_quantity ?? product.availableQuantity ?? product.stock_quantity ?? 0;
    const effectiveStockQuantity = inventory?.effectiveStockQuantity ?? masterStock;
    const inventoryUpdatedAt = inventory?.updatedAt.toISOString() ?? product.updated_at ?? product.updatedAt ?? null;

    return {
      ...product,
      availableQuantity: effectiveStockQuantity,
      available_quantity: effectiveStockQuantity,
      stock_quantity: effectiveStockQuantity,
      variant_count: variants.length,
      variantCount: variants.length,
      variants,
      media_assets: mediaAssets,
      mediaAssets,
      media_urls: mediaUrls,
      mediaUrls,
      main_image_url: mainImageUrl,
      mainImageUrl,
      costFinal: costBreakdown.finalCost,
      costBreakdown,
      master_stock: masterStock,
      masterStock,
      custom_stock_quantity: inventory?.customStockQuantity ?? null,
      customStockQuantity: inventory?.customStockQuantity ?? null,
      variant_stock_quantity_total: inventory?.variantStockQuantityTotal ?? null,
      variantStockQuantityTotal: inventory?.variantStockQuantityTotal ?? null,
      has_variant_inventory: inventory?.hasVariantInventory ?? false,
      hasVariantInventory: inventory?.hasVariantInventory ?? false,
      effective_stock_quantity: effectiveStockQuantity,
      effectiveStockQuantity,
      inventory_updated_at: inventoryUpdatedAt,
      inventoryUpdatedAt
    };
  }

  private buildCompanyPayload(
    companyContext: CompanyCatalogContext
  ) {
    const legalName = companyContext.companyName;
    const externalCode = companyContext.companyExternalCode;

    return {
      id: companyContext.companyId,
      company_id: companyContext.companyId,
      companyId: companyContext.companyId,
      legal_name: legalName,
      legalName,
      external_code: externalCode,
      externalCode,
      company_name: legalName,
      companyName: legalName,
      is_active: companyContext.companyIsActive,
      isActive: companyContext.companyIsActive,
      sync_store_inventory: companyContext.companySyncStoreInventory,
      syncStoreInventory: companyContext.companySyncStoreInventory,
      api_key_count: companyContext.companyApiKeyCount,
      apiKeyCount: companyContext.companyApiKeyCount,
      active_key_count: companyContext.companyActiveKeyCount,
      activeKeyCount: companyContext.companyActiveKeyCount,
      created_at: companyContext.companyCreatedAt,
      createdAt: companyContext.companyCreatedAt,
      updated_at: companyContext.companyUpdatedAt,
      updatedAt: companyContext.companyUpdatedAt
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
