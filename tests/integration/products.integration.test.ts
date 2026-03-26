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
    assert.equal(firstResponse.json().data[0].serialNumber, "SKU-001");
    assert.equal(firstResponse.json().data[0].variants.length, 1);
    assert.equal(firstResponse.json().data[0].variants[0].sku, "SKU-001-ARO-16");
    assert.equal(firstResponse.json().data[0].baseMaterial, "Prata 925");
    assert.equal(firstResponse.json().data[0].costFinal, 56.15);
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(secondResponse.json().meta.source, "cache");
    assert.equal(secondResponse.json().data[0].costBreakdown.finalCost, 56.15);
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
          variants: [],
          id: "prod-stale",
          product_id: "prod-stale",
          code: "SKU-STALE",
          sku: "SKU-STALE",
          numero_serie: "SKU-STALE",
          name: "Produto Cache",
          nome: "Produto Cache",
          serialNumber: "SKU-STALE",
          description: "Descricao cache",
          descricao: "Descricao cache",
          category: "Categoria cache",
          categoria: "Categoria cache",
          subcategory: "Subcategoria cache",
          subcategoria: "Subcategoria cache",
          material: "Prata 925",
          baseMaterial: "Prata 925",
          material_base: "Prata 925",
          purity: "925",
          pureza: "925",
          weight_grams: "1.0",
          weightGrams: "1.0",
          peso_gramas: "1.0",
          bathType: null,
          tipo_banho: null,
          status: "AVAILABLE",
          bronzeImageKey: null,
          s3_key_bronze: null,
          silverImageKey: null,
          s3_key_silver: null,
          supplierCode: null,
          supplier_code: null,
          fiscalCode: null,
          fiscal_code: null,
          categoryId: null,
          category_id: null,
          productType: "Prata 925",
          tipo: "Prata 925",
          typeId: null,
          type_id: null,
          subcategoryId: null,
          subcategory_id: null,
          blingProductId: null,
          bling_product_id: null,
          blingLastSyncAt: null,
          bling_last_sync_at: null,
          laborRateId: null,
          labor_rate_id: null,
          laborRateLabel: null,
          labor_rate_label: null,
          laborCost: null,
          labor_cost: null,
          sizeOptionId: null,
          size_option_id: null,
          sizeLabel: null,
          size_label: null,
          colorOptionId: null,
          color_option_id: null,
          colorLabel: null,
          color_label: null,
          availableQuantity: 1,
          available_quantity: null,
          stock_quantity: 1,
          ncm: null,
          laborRateTableId: null,
          labor_rate_table_id: null,
          laborRateTableName: null,
          labor_rate_table_name: null,
          createdAt: "2026-03-23T00:00:00.000Z",
          created_at: "2026-03-23T00:00:00.000Z",
          price: 5,
          updatedAt: "2026-03-23T00:00:00.000Z",
          updated_at: "2026-03-23T00:00:00.000Z"
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
    assert.equal(response.json().data[0].costFinal, 5.8);
  });
});
