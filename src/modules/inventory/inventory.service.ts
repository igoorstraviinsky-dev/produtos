import { AppEnv } from "../../config/env";
import { ControlPlaneRepository, MasterProductRecord } from "../../lib/postgres";
import { ProductCacheStore } from "../../lib/redis";
import { ProductGateway, ProductRecord } from "../../lib/supabase";
import { AppError } from "../../middleware/error-handler";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import { calculateProductCost } from "../products/cost-calculator";
import { attachVariantMetrics, buildVariantMetrics } from "../products/variant-metrics";
import {
  MyInventoryItem,
  MyInventoryResponse,
  MyInventorySyncError,
  MyInventorySyncResponse,
  SyncMyInventoryItem,
  SyncMyInventoryVariantItem
} from "./inventory.schemas";

type ProductCacheEntry = {
  cachedAt: string;
  data: ProductRecord[];
};

function mapInventoryItem(
  record: {
  productId: string;
  sku: string;
  name: string;
  masterStock: number;
  customStockQuantity: number | null;
  variantStockQuantityTotal: number | null;
  hasVariantInventory: boolean;
  effectiveStockQuantity: number;
  updatedAt: Date;
  variants: Array<{
    variantId: string;
    productId: string;
    sku: string;
    individualWeight: number | null;
    masterStock: number;
    customStockQuantity: number | null;
    effectiveStockQuantity: number;
    updatedAt: Date;
  }>;
},
  productCostById: Map<string, number>
): MyInventoryItem {
  return {
    productId: record.productId,
    sku: record.sku,
    name: record.name,
    masterStock: record.masterStock,
    customStockQuantity: record.customStockQuantity,
    variantStockQuantityTotal: record.variantStockQuantityTotal,
    hasVariantInventory: record.hasVariantInventory,
    effectiveStockQuantity: record.effectiveStockQuantity,
    updatedAt: record.updatedAt.toISOString(),
    variants: record.variants.map((variant) => ({
      ...attachVariantMetrics(
        {
          variantId: variant.variantId,
          productId: variant.productId,
          sku: variant.sku,
          individualWeight: variant.individualWeight,
          masterStock: variant.masterStock,
          customStockQuantity: variant.customStockQuantity,
          effectiveStockQuantity: variant.effectiveStockQuantity,
          updatedAt: variant.updatedAt.toISOString()
        },
        buildVariantMetrics({
          individualWeight: variant.individualWeight,
          stockWeightGrams: variant.effectiveStockQuantity,
          productCostFinal: productCostById.get(record.productId) ?? null
        })
      )
    }))
  };
}

export class InventoryService {
  constructor(
    private readonly controlPlane: ControlPlaneRepository,
    private readonly productGateway: ProductGateway,
    private readonly productCache: ProductCacheStore,
    private readonly env: Pick<AppEnv, "PRODUCTS_CACHE_TTL_SECONDS" | "PRODUCTS_CACHE_STALE_SECONDS">
  ) {}

  private isFresh(entry: ProductCacheEntry, now: number) {
    return now - Date.parse(entry.cachedAt) <= this.env.PRODUCTS_CACHE_TTL_SECONDS * 1000;
  }

  private isServeableStale(entry: ProductCacheEntry, now: number) {
    return (
      now - Date.parse(entry.cachedAt) <=
      (this.env.PRODUCTS_CACHE_TTL_SECONDS + this.env.PRODUCTS_CACHE_STALE_SECONDS) * 1000
    );
  }

  private async listCatalogProductsCached() {
    const cacheKey = buildProductsCacheKey();
    const now = Date.now();
    const cachedEntry = await this.productCache.get<ProductCacheEntry>(cacheKey);

    if (cachedEntry && this.isFresh(cachedEntry, now)) {
      return cachedEntry.data;
    }

    try {
      const products = await this.productGateway.listProducts();
      await this.productCache.set<ProductCacheEntry>(
        cacheKey,
        {
          cachedAt: new Date(now).toISOString(),
          data: products
        },
        this.env.PRODUCTS_CACHE_TTL_SECONDS + this.env.PRODUCTS_CACHE_STALE_SECONDS
      );
      return products;
    } catch (error) {
      if (cachedEntry && this.isServeableStale(cachedEntry, now)) {
        return cachedEntry.data;
      }

      throw error;
    }
  }

  private async buildProductCostById(companyId: string, productIds?: Set<string>) {
    try {
      const [products, costSettings] = await Promise.all([
        this.listCatalogProductsCached(),
        this.controlPlane.getCostSettings(companyId)
      ]);

      return new Map(
        products
          .filter((product) => !productIds || productIds.has(product.id))
          .map((product) => [
          product.id,
          calculateProductCost(product, costSettings).finalCost
          ])
      );
    } catch {
      return new Map<string, number>();
    }
  }

  private async resolveMasterProduct(
    item: SyncMyInventoryItem,
    productsById: Map<string, MasterProductRecord | null>,
    productsBySku: Map<string, MasterProductRecord | null>
  ): Promise<MasterProductRecord | null> {
    if (item.productId) {
      if (!productsById.has(item.productId)) {
        productsById.set(
          item.productId,
          await this.controlPlane.findMasterProductById(item.productId)
        );
      }

      return productsById.get(item.productId) ?? null;
    }

    const candidateSku = item.sku ?? item.code ?? item.numeroSerie;
    if (!candidateSku) {
      return null;
    }

    if (!productsBySku.has(candidateSku)) {
      productsBySku.set(candidateSku, await this.controlPlane.findMasterProductBySku(candidateSku));
    }

    return productsBySku.get(candidateSku) ?? null;
  }

  private buildSyncError(index: number, item: SyncMyInventoryItem, message: string): MyInventorySyncError {
    return {
      index,
      productId: item.productId,
      sku: item.sku,
      code: item.code,
      numeroSerie: item.numeroSerie,
      message
    };
  }

  private buildVariantSyncError(
    index: number,
    item: SyncMyInventoryItem,
    variant: SyncMyInventoryVariantItem,
    message: string
  ): MyInventorySyncError {
    return {
      index,
      productId: item.productId,
      sku: item.sku,
      code: item.code,
      numeroSerie: item.numeroSerie,
      variantId: variant.variantId,
      variantSku: variant.sku,
      message
    };
  }

  async listMyInventory(companyId: string): Promise<MyInventoryResponse> {
    const inventory = await this.controlPlane.listEffectiveInventoryByCompany(companyId);
    const productCostById = await this.buildProductCostById(
      companyId,
      new Set(inventory.map((item) => item.productId))
    );

    return {
      data: inventory.map((item) => mapInventoryItem(item, productCostById)),
      meta: {
        count: inventory.length,
        companyId
      }
    };
  }

  async updateMyInventory(
    companyId: string,
    productId: string,
    customStockQuantity: number
  ) {
    const updatedInventory = await this.controlPlane.upsertCompanyInventory(
      companyId,
      productId,
      customStockQuantity
    );

    if (!updatedInventory) {
      throw new AppError(
        404,
        "PRODUCT_NOT_FOUND_IN_INVENTORY",
        "Produto nao encontrado no seu inventario"
      );
    }

    const productCostById = await this.buildProductCostById(companyId, new Set([productId]));

    return {
      data: mapInventoryItem(updatedInventory, productCostById)
    };
  }

  async syncMyInventory(
    companyId: string,
    items: SyncMyInventoryItem[]
  ): Promise<MyInventorySyncResponse> {
    const errors: MyInventorySyncError[] = [];
    const productsById = new Map<string, MasterProductRecord | null>();
    const productsBySku = new Map<string, MasterProductRecord | null>();
    const variantsByProductId = new Map<
      string,
      Array<{
        id: string;
        productId: string;
        sku: string;
        individualWeight: number | null;
        individualStock: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    >();
    const touchedProductIds = new Set<string>();

    for (const [index, item] of items.entries()) {
      const product = await this.resolveMasterProduct(item, productsById, productsBySku);

      if (!product) {
        errors.push(
          this.buildSyncError(
            index,
            item,
            "Produto nao encontrado para o product_id ou sku/codigo informado"
          )
        );
        continue;
      }

      if (!variantsByProductId.has(product.id)) {
        variantsByProductId.set(
          product.id,
          await this.controlPlane.listProductVariantsByProductId(product.id)
        );
      }

      const productVariants = variantsByProductId.get(product.id) ?? [];
      const hasVariantUpdates = item.variants.length > 0;

      if (hasVariantUpdates && item.customStockQuantity === null) {
        await this.controlPlane.deleteCompanyInventory(companyId, product.id);
      }

      if (item.customStockQuantity !== null) {
        const updatedInventory = await this.controlPlane.upsertCompanyInventory(
          companyId,
          product.id,
          item.customStockQuantity
        );

        if (!updatedInventory) {
          errors.push(
            this.buildSyncError(
              index,
              item,
              "Produto nao encontrado no catalogo mestre local para atualizacao"
            )
          );
          continue;
        }
      }

      for (const variant of item.variants) {
        const matchedVariant =
          productVariants.find((record) => record.id === variant.variantId) ??
          productVariants.find((record) => record.sku === variant.sku) ??
          null;

        if (!matchedVariant) {
          errors.push(
            this.buildVariantSyncError(
              index,
              item,
              variant,
              "Variante nao encontrada para o produto informado"
            )
          );
          continue;
        }

        await this.controlPlane.upsertCompanyVariantInventory(
          companyId,
          matchedVariant.id,
          variant.customStockQuantity
        );
      }

      if (item.customStockQuantity !== null || hasVariantUpdates) {
        touchedProductIds.add(product.id);
      }
    }

    const inventory = await this.controlPlane.listEffectiveInventoryByCompany(companyId);
    const scopedProductIds =
      touchedProductIds.size > 0
        ? touchedProductIds
        : new Set(inventory.map((record) => record.productId));
    const productCostById = await this.buildProductCostById(companyId, scopedProductIds);
    const updatedItems = inventory
      .filter((record) => touchedProductIds.has(record.productId))
      .map((item) => mapInventoryItem(item, productCostById));

    if (updatedItems.length === 0 && errors.length === 0) {
      return {
        data: [],
        errors: [],
        meta: {
          companyId,
          receivedCount: items.length,
          updatedCount: 0,
          errorCount: 0
        }
      };
    }

    return {
      data: updatedItems,
      errors,
      meta: {
        companyId,
        receivedCount: items.length,
        updatedCount: updatedItems.length,
        errorCount: errors.length
      }
    };
  }
}
