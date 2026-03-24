import { ProductGateway } from "../../lib/supabase";
import { ProductCacheStore } from "../../lib/redis";
import { buildProductsCacheKey } from "../../utils/cache-keys";

type UpdateInventoryProductInput = {
  id: string;
  sku: string;
  name: string;
  availableQuantity: number;
};

export class ProductsAdminService {
  constructor(
    private readonly productGateway: ProductGateway,
    private readonly productCache: ProductCacheStore
  ) {}

  async listProducts() {
    return this.productGateway.listProducts();
  }

  async updateProduct(input: UpdateInventoryProductInput) {
    const product = await this.productGateway.updateProduct(input);
    await this.productCache.delete(buildProductsCacheKey());
    return product;
  }
}
