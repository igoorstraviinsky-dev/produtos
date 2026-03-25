import { ControlPlaneRepository } from "../../lib/postgres";
import { ProductGateway } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { buildProductsCacheKey } from "../../utils/cache-keys";
import { calculateProductCost } from "./cost-calculator";

type UpdateInventoryProductInput = {
  id: string;
  sku: string;
  name: string;
  availableQuantity: number;
};

export class ProductsAdminService {
  constructor(
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
        updatedAt: product.updatedAt ? new Date(product.updatedAt) : new Date()
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

  async listProducts() {
    const [products, costSettings] = await Promise.all([
      this.productGateway.listProducts(),
      this.controlPlane.getCostSettings()
    ]);

    await this.syncMasterCatalogFromUpstream(products);

    return products.map((product) => {
      const costBreakdown = calculateProductCost(product, costSettings);
      return {
        ...product,
        costFinal: costBreakdown.finalCost,
        costBreakdown
      };
    });
  }

  async updateProduct(input: UpdateInventoryProductInput) {
    await this.productGateway.updateProduct(input);
    const allProducts = await this.productGateway.listProducts();
    await this.syncMasterCatalogFromUpstream(allProducts);
    const product = allProducts.find((item) => item.id === input.id);

    if (!product) {
      throw new Error("Updated product not found after upstream sync");
    }

    const costSettings = await this.controlPlane.getCostSettings();
    const costBreakdown = calculateProductCost(product, costSettings);

    return {
      ...product,
      costFinal: costBreakdown.finalCost,
      costBreakdown
    };
  }
}
