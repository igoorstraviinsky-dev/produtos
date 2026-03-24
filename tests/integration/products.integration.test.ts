import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { deriveApiKeyPrefix, hashApiKey } from "../../src/utils/crypto";
import { buildProductsCacheKey } from "../../src/utils/cache-keys";
import { createTestApp } from "../helpers/fakes";

describe("Products integration", () => {
  const appsToClose: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(appsToClose.splice(0).map((item) => item.close()));
  });

  it("returns upstream data and then cached data", async () => {
    const { app, controlPlane, env } = await createTestApp();
    appsToClose.push(app);

    const company = controlPlane.seedCompany({
      legalName: "Empresa Produtos",
      externalCode: "empresa-produtos"
    });
    const apiKey = "b2b_products_ok_123";

    controlPlane.seedApiKey({
      companyId: company.id,
      keyPrefix: deriveApiKeyPrefix(apiKey),
      keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
      rateLimitPerMinute: 10
    });

    const firstResponse = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    const secondResponse = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.json().meta.source, "upstream");
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(secondResponse.json().meta.source, "cache");
  });

  it("falls back to stale cache on upstream failure", async () => {
    const { app, controlPlane, env, productCache, productGateway } = await createTestApp({
      env: {
        PRODUCTS_CACHE_TTL_SECONDS: 1,
        PRODUCTS_CACHE_STALE_SECONDS: 120
      }
    });
    appsToClose.push(app);

    const company = controlPlane.seedCompany({
      legalName: "Empresa Cache",
      externalCode: "empresa-cache"
    });
    const apiKey = "b2b_products_stale_123";

    controlPlane.seedApiKey({
      companyId: company.id,
      keyPrefix: deriveApiKeyPrefix(apiKey),
      keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
      rateLimitPerMinute: 10
    });

    await productCache.set(buildProductsCacheKey(), {
      cachedAt: new Date(Date.now() - 10_000).toISOString(),
      data: [
        {
          id: "prod-stale",
          sku: "SKU-STALE",
          name: "Produto Cache",
          availableQuantity: 1,
          price: 5,
          updatedAt: "2026-03-23T00:00:00.000Z"
        }
      ]
    });

    productGateway.error = new Error("Remote source unavailable");

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.stale, true);
  });
});
