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
        variants: [
          {
            variant_id: "variant-1",
            variantId: "variant-1",
            product_id: "prod-1",
            productId: "prod-1",
            sku: "SKU-001-AZUL",
            individual_weight: "5.5",
            individualWeight: "5.5",
            individual_stock: 2,
            individualStock: 2,
            size_labels: ["ARO 18"],
            sizeLabels: ["ARO 18"],
            color_labels: ["AZUL"],
            colorLabels: ["AZUL"],
            options: [
              {
                id: "option-size-1",
                kind: "size",
                label: "ARO 18"
              },
              {
                id: "option-color-1",
                kind: "color",
                label: "AZUL"
              }
            ],
            created_at: "2026-03-23T00:00:00.000Z",
            createdAt: "2026-03-23T00:00:00.000Z",
            updated_at: "2026-03-23T00:00:00.000Z",
            updatedAt: "2026-03-23T00:00:00.000Z",
          }
        ],
        id: "prod-1",
        product_id: "prod-1",
        code: "SKU-001",
        sku: "SKU-001",
        numero_serie: "SKU-001",
        name: "Produto 1",
        nome: "Produto 1",
        serialNumber: "SKU-001",
        description: "Descricao teste",
        descricao: "Descricao teste",
        category: "Categoria teste",
        categoria: "Categoria teste",
        subcategory: "Subcategoria teste",
        subcategoria: "Subcategoria teste",
        material: "Prata 925",
        baseMaterial: "Prata 925",
        material_base: "Prata 925",
        purity: "925",
        pureza: "925",
        weight_grams: "5.5",
        weightGrams: "5.5",
        peso_gramas: "5.5",
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
        availableQuantity: 5,
        available_quantity: null,
        stock_quantity: 5,
        ncm: null,
        laborRateTableId: null,
        labor_rate_table_id: null,
        laborRateTableName: null,
        labor_rate_table_name: null,
        createdAt: "2026-03-23T00:00:00.000Z",
        created_at: "2026-03-23T00:00:00.000Z",
        price: 10,
        updatedAt: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z"
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
    assert.equal(firstResponse.data[0].costFinal, 29.65);
    assert.equal(secondResponse.meta.source, "cache");
    assert.equal(secondResponse.data[0].costBreakdown.finalCost, 29.65);
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
          variants: [],
          id: "prod-1",
          product_id: "prod-1",
          code: "SKU-001",
          sku: "SKU-001",
          numero_serie: "SKU-001",
          name: "Produto 1",
          nome: "Produto 1",
          serialNumber: "SKU-001",
          description: "Descricao teste",
          descricao: "Descricao teste",
          category: "Categoria teste",
          categoria: "Categoria teste",
          subcategory: "Subcategoria teste",
          subcategoria: "Subcategoria teste",
          material: "Prata 925",
          baseMaterial: "Prata 925",
          material_base: "Prata 925",
          purity: "925",
          pureza: "925",
          weight_grams: "5.5",
          weightGrams: "5.5",
          peso_gramas: "5.5",
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
          availableQuantity: 5,
          available_quantity: null,
          stock_quantity: 5,
          ncm: null,
          laborRateTableId: null,
          labor_rate_table_id: null,
          laborRateTableName: null,
          labor_rate_table_name: null,
          createdAt: "2026-03-23T00:00:00.000Z",
          created_at: "2026-03-23T00:00:00.000Z",
          price: 10,
          updatedAt: "2026-03-23T00:00:00.000Z",
          updated_at: "2026-03-23T00:00:00.000Z"
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
    assert.equal(response.data[0].costFinal, 29.65);
  });
});
