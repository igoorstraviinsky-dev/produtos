import { ControlPlaneRepository } from "../../lib/postgres";
import { ProductCacheStore } from "../../lib/redis";
import { ProductGateway } from "../../lib/supabase";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import { RealtimeHub } from "../realtime/realtime-hub";

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

export class WebhooksService {
  constructor(
    private readonly controlPlane: ControlPlaneRepository,
    private readonly productGateway: ProductGateway,
    private readonly productCache: ProductCacheStore,
    private readonly realtimeHub: RealtimeHub
  ) {}

  async syncMasterCatalog() {
    const upstreamProducts = await this.productGateway.listProducts();
    const syncedProducts = await this.controlPlane.replaceMasterProducts(
      upstreamProducts.map((product) => ({
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
    this.realtimeHub.broadcastProductUpdated({
      productCount: syncedProducts.length,
      updatedAt: new Date().toISOString()
    });

    return {
      data: {
        syncedCount: syncedProducts.length,
        updatedAt: new Date().toISOString()
      }
    };
  }
}
