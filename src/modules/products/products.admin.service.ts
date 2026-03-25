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

  async listProducts() {
    const [products, costSettings] = await Promise.all([
      this.productGateway.listProducts(),
      this.controlPlane.getCostSettings()
    ]);

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
    const product = await this.productGateway.updateProduct(input);
    await this.productCache.delete(buildProductsCacheKey());
    const costSettings = await this.controlPlane.getCostSettings();
    const costBreakdown = calculateProductCost(product, costSettings);

    return {
      ...product,
      costFinal: costBreakdown.finalCost,
      costBreakdown
    };
  }
}
