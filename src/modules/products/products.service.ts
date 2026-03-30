import { FastifyBaseLogger } from "fastify";

import { AppEnv } from "../../config/env";
import {
  CompanyRecord,
  ControlPlaneRepository,
  EffectiveInventoryRecord
} from "../../lib/postgres";
import { ProductGateway, ProductRecord } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { AppError } from "../../middleware/error-handler";
import { buildProductsCacheKey } from "../../utils/cache-keys";
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

type ProductListMeta = {
  source: "cache" | "upstream";
  stale?: boolean;
  count: number;
};

type CompanyCatalogContext = Pick<AuthContext, "companyId" | "companyExternalCode" | "companyName">;

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
    const [{ products, meta }, costSettings, laborRateTables, productTypes] = await Promise.all([
      this.listRawProducts(),
      this.options.controlPlane.getCostSettings(),
      this.options.productGateway.listLaborRateTables(),
      this.options.productGateway.listProductTypes()
    ]);

    return {
      data: products.map((product) => this.enrichProduct(product, costSettings)),
      meta: {
        ...meta,
        laborRateTables,
        materialTypes: this.buildMaterialTypes(productTypes, products, laborRateTables)
      }
    };
  }

  async listCompanyCatalog(companyContext: CompanyCatalogContext): Promise<CompanyCatalogResponse> {
    const [
      { products, meta },
      costSettings,
      effectiveInventory,
      companyRecord,
      laborRateTables,
      productTypes
    ] =
      await Promise.all([
        this.listRawProducts(),
        this.options.controlPlane.getCostSettings(companyContext.companyId),
        this.options.controlPlane.listEffectiveInventoryByCompany(companyContext.companyId),
        this.options.controlPlane.findCompanyById(companyContext.companyId),
        this.options.productGateway.listLaborRateTables(),
        this.options.productGateway.listProductTypes()
      ]);
    const inventoryByProductId = new Map(
      effectiveInventory.map((item) => [item.productId, item] as const)
    );

    return {
      company: this.buildCompanyPayload(companyContext, companyRecord),
      data: products.map((product) =>
        this.enrichCompanyProduct(
          product,
          costSettings,
          inventoryByProductId.get(product.id) ?? null
        )
      ),
      meta: {
        ...meta,
        companyId: companyContext.companyId,
        companyExternalCode: companyContext.companyExternalCode,
        companyName: companyContext.companyName,
        laborRateTables,
        materialTypes: this.buildMaterialTypes(productTypes, products, laborRateTables)
      }
    };
  }

  private buildMaterialTypes(
    productTypes: Awaited<ReturnType<ProductGateway["listProductTypes"]>>,
    products: ProductRecord[],
    laborRateTables: Awaited<ReturnType<ProductGateway["listLaborRateTables"]>>
  ) {
    const productTypeById = new Map(productTypes.map((item) => [item.id, item] as const));
    const laborRateTableById = new Map(laborRateTables.map((item) => [item.id, item] as const));
    const laborTablesByTypeId = new Map<string, Map<string, (typeof laborRateTables)[number]>>();

    for (const product of products) {
      const typeId = product.typeId ?? product.type_id ?? null;
      if (!typeId) {
        continue;
      }

      const laborRateTableId =
        product.laborRateTableId ?? product.labor_rate_table_id ?? null;
      const laborRateTableName =
        product.laborRateTableName ?? product.labor_rate_table_name ?? null;

      if (!laborRateTableId && !laborRateTableName) {
        continue;
      }

      const bucket = laborTablesByTypeId.get(typeId) ?? new Map();
      const resolvedTable =
        (laborRateTableId ? laborRateTableById.get(laborRateTableId) : null) ??
        (laborRateTableName
          ? {
              id: laborRateTableId ?? `labor-rate-table:${laborRateTableName}`,
              name: laborRateTableName,
              nome: laborRateTableName,
              label: laborRateTableName
            }
          : null);

      if (resolvedTable) {
        bucket.set(resolvedTable.id, resolvedTable);
        laborTablesByTypeId.set(typeId, bucket);
      }
    }

    return productTypes.map((productType) => ({
      ...productType,
      laborRateTables: [...(laborTablesByTypeId.get(productType.id)?.values() ?? [])].sort(
        (left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" })
      )
    }));
  }

  private async listRawProducts(): Promise<{ products: ProductRecord[]; meta: ProductListMeta }> {
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
        products: cachedEntry.data,
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
        products,
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
          products: cachedEntry.data,
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
    companyContext: CompanyCatalogContext,
    companyRecord: CompanyRecord | null
  ) {
    const legalName = companyRecord?.legalName ?? companyContext.companyName;
    const externalCode = companyRecord?.externalCode ?? companyContext.companyExternalCode;
    const createdAt = companyRecord?.createdAt.toISOString() ?? null;
    const updatedAt = companyRecord?.updatedAt.toISOString() ?? null;

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
      is_active: companyRecord?.isActive ?? true,
      isActive: companyRecord?.isActive ?? true,
      sync_store_inventory: companyRecord?.syncStoreInventory ?? false,
      syncStoreInventory: companyRecord?.syncStoreInventory ?? false,
      api_key_count: companyRecord?.apiKeyCount ?? 0,
      apiKeyCount: companyRecord?.apiKeyCount ?? 0,
      active_key_count: companyRecord?.activeKeyCount ?? 0,
      activeKeyCount: companyRecord?.activeKeyCount ?? 0,
      created_at: createdAt,
      createdAt,
      updated_at: updatedAt,
      updatedAt
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
