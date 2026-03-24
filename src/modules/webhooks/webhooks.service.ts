import { ControlPlaneRepository } from "../../lib/postgres";
import { ProductCacheStore } from "../../lib/redis";
import { ProductGateway } from "../../lib/supabase";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import { RealtimeHub } from "../realtime/realtime-hub";

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
        updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date()
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
