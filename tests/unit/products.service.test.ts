import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProductsService } from "../../src/modules/products/products.service";
import {
  FakeProductCacheStore,
  FakeProductGateway,
  createTestEnv
} from "../helpers/fakes";
import { buildProductsCacheKey } from "../../src/utils/cache-keys";

describe("ProductsService", () => {
  it("caches successful upstream responses", async () => {
    const env = createTestEnv();
    const cacheStore = new FakeProductCacheStore();
    const productGateway = new FakeProductGateway([
      {
        id: "prod-1",
        sku: "SKU-001",
        name: "Produto 1",
        availableQuantity: 5,
        price: 10,
        updatedAt: "2026-03-23T00:00:00.000Z"
      }
    ]);

    const service = new ProductsService({
      env,
      cacheStore,
      productGateway
    });

    const firstResponse = await service.listProducts();
    const secondResponse = await service.listProducts();

    assert.equal(firstResponse.meta.source, "upstream");
    assert.equal(secondResponse.meta.source, "cache");
  });

  it("serves stale cache when upstream fails", async () => {
    const env = createTestEnv({
      PRODUCTS_CACHE_TTL_SECONDS: 1,
      PRODUCTS_CACHE_STALE_SECONDS: 300
    });
    const cacheStore = new FakeProductCacheStore();
    const productGateway = new FakeProductGateway([]);
    const cacheKey = buildProductsCacheKey();

    await cacheStore.set(cacheKey, {
      cachedAt: new Date(Date.now() - 60_000).toISOString(),
      data: [
        {
          id: "prod-1",
          sku: "SKU-001",
          name: "Produto 1",
          availableQuantity: 5,
          price: 10,
          updatedAt: "2026-03-23T00:00:00.000Z"
        }
      ]
    });

    productGateway.error = new Error("Supabase unavailable");

    const service = new ProductsService({
      env,
      cacheStore,
      productGateway
    });

    const response = await service.listProducts();

    assert.equal(response.meta.source, "cache");
    assert.equal(response.meta.stale, true);
  });
});
