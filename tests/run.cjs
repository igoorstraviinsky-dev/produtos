const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { Readable } = require("node:stream");

const YAML = require("yaml");

const { buildApp } = require("../dist/app.js");
const { ApiKeyService } = require("../dist/modules/auth/api-key.service.js");
const { SupabaseProductGateway } = require("../dist/lib/supabase.js");
const { calculateProductCost } = require("../dist/modules/products/cost-calculator.js");
const { ProductsService } = require("../dist/modules/products/products.service.js");
const { buildProductsCacheKey } = require("../dist/utils/cache-keys.js");
const { deriveApiKeyPrefix, hashApiKey } = require("../dist/utils/crypto.js");

function createTestEnv(overrides = {}) {
  return {
    PORT: 3000,
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
    PUBLIC_BASE_URL: "https://api.example.com",
    LOCAL_MEDIA_ROOT: undefined,
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_PRODUCTS_TABLE: "products",
    API_KEY_PEPPER: "test-pepper-value",
    INTERNAL_WEBHOOK_SECRET: "test-internal-sync-secret",
    PRODUCTS_CACHE_TTL_SECONDS: 60,
    PRODUCTS_CACHE_STALE_SECONDS: 300,
    WEBSOCKET_AUTH_TIMEOUT_MS: 5000,
    ADMIN_TOKEN: undefined,
    ADMIN_USERNAME: undefined,
    ADMIN_PASSWORD: undefined,
    ADMIN_SESSION_SECRET: undefined,
    ...overrides
  };
}

class FakeControlPlaneRepository {
  constructor() {
    this.companies = new Map();
    this.apiKeys = new Map();
    this.masterProducts = new Map();
    this.companyInventory = new Map();
    this.companyVariantInventory = new Map();
      this.companyCostSettings = new Map();
      this.companyCostSettingsHistory = new Map();
      this.costSettings = {
        companyId: null,
        silverPricePerGram: 1,
      zonaFrancaRatePercent: 6,
      transportFee: 0.1,
      dollarRate: 5,
      updatedAt: new Date()
    };
  }

  buildCompanySnapshot(company) {
    const companyApiKeys = [...this.apiKeys.values()].filter(
      (apiKey) => apiKey.companyId === company.id
    );

    return {
      ...company,
      apiKeyCount: companyApiKeys.length,
      activeKeyCount: companyApiKeys.filter((apiKey) => !apiKey.isRevoked).length
    };
  }

  seedCompany(input) {
    const now = new Date();
    const company = {
      id: input.id ?? randomUUID(),
      legalName: input.legalName,
      externalCode: input.externalCode,
      isActive: input.isActive ?? true,
      syncStoreInventory: false,
      createdAt: now,
      updatedAt: now
    };

    this.companies.set(company.id, company);
    return this.buildCompanySnapshot(company);
  }

  seedApiKey(input) {
    const company = this.companies.get(input.companyId);
    if (!company) {
      throw new Error("Company seed missing");
    }

    const apiKey = {
      id: input.id ?? randomUUID(),
      companyId: company.id,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      rateLimitPerMinute: input.rateLimitPerMinute,
      isRevoked: input.isRevoked ?? false,
      revokedAt: input.isRevoked ? new Date() : null,
      lastUsedAt: null,
      createdAt: new Date()
    };

    this.apiKeys.set(apiKey.id, apiKey);
    const snapshot = {
      ...apiKey,
      company: this.buildCompanySnapshot(company)
    };
    this.apiKeys.set(apiKey.id, snapshot);
    return snapshot;
  }

  async createCompany(input) {
    return this.seedCompany(input);
  }

  async listCompanies() {
    return [...this.companies.values()].map((company) => this.buildCompanySnapshot(company));
  }

  async updateCompany(companyId, input) {
    const company = this.companies.get(companyId);
    if (!company) {
      return null;
    }

    const updated = {
      ...company,
      ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.syncStoreInventory !== undefined
        ? { syncStoreInventory: input.syncStoreInventory }
        : {}),
      updatedAt: new Date()
    };
    this.companies.set(companyId, updated);

    for (const [apiKeyId, apiKey] of this.apiKeys.entries()) {
      if (apiKey.companyId === companyId) {
        this.apiKeys.set(apiKeyId, {
          ...apiKey,
          company: this.buildCompanySnapshot(updated)
        });
      }
    }

    return this.buildCompanySnapshot(updated);
  }

  async updateCompanyStatus(companyId, isActive) {
    return this.updateCompany(companyId, {
      isActive
    });
  }

  async deleteCompany(companyId) {
    const company = this.companies.get(companyId);
    if (!company) {
      return null;
    }

    for (const [apiKeyId, apiKey] of [...this.apiKeys.entries()]) {
      if (apiKey.companyId === companyId) {
        this.apiKeys.delete(apiKeyId);
      }
    }

    for (const key of [...this.companyInventory.keys()]) {
      if (key.startsWith(`${companyId}:`)) {
        this.companyInventory.delete(key);
      }
    }

    this.companies.delete(companyId);
    return this.buildCompanySnapshot(company);
  }

  async findCompanyById(companyId) {
    const company = this.companies.get(companyId);
    return company ? this.buildCompanySnapshot(company) : null;
  }

  async createApiKey(input) {
    return this.seedApiKey(input);
  }

  async revokeApiKey(apiKeyId) {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) {
      return null;
    }

    const updated = {
      ...apiKey,
      isRevoked: true,
      revokedAt: new Date(),
      company: this.buildCompanySnapshot(this.companies.get(apiKey.companyId))
    };
    this.apiKeys.set(apiKeyId, updated);
    return updated;
  }

  async findApiKeyByHash(keyHash) {
    return [...this.apiKeys.values()].find((apiKey) => apiKey.keyHash === keyHash) ?? null;
  }

  async touchApiKeyUsage(apiKeyId, usedAt) {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) {
      return;
    }

    this.apiKeys.set(apiKeyId, {
      ...apiKey,
      lastUsedAt: usedAt
    });
  }

  async replaceMasterProducts(products) {
    const nextProducts = new Map(products.map((product) => [product.id, { ...product }]));
    this.masterProducts = nextProducts;

    for (const key of [...this.companyInventory.keys()]) {
      const [, productId] = key.split(":");
      if (!this.masterProducts.has(productId)) {
        this.companyInventory.delete(key);
      }
    }

    return this.listMasterProducts();
  }

  async listMasterProducts() {
    return [...this.masterProducts.values()].sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }

  async findMasterProductById(productId) {
    return this.masterProducts.get(productId) ?? null;
  }

  async findMasterProductBySku(sku) {
    return [...this.masterProducts.values()].find((product) => product.sku === sku) ?? null;
  }

  async listProductVariantsByProductId(productId) {
    const product = this.masterProducts.get(productId);
    return product?.variants ?? [];
  }

  async getCostSettings(companyId) {
    if (!companyId) {
      return this.costSettings;
    }

    if (!this.companyCostSettings.has(companyId)) {
      this.companyCostSettings.set(companyId, {
        companyId,
        silverPricePerGram: 1,
        zonaFrancaRatePercent: 6,
        transportFee: 0.1,
        dollarRate: 5,
        updatedAt: new Date()
      });
    }

    return this.companyCostSettings.get(companyId);
  }

  async updateCostSettings(input, companyId) {
    const current = await this.getCostSettings(companyId);
    this.costSettings = {
      companyId: null,
      silverPricePerGram: input.silverPricePerGram ?? this.costSettings.silverPricePerGram,
      zonaFrancaRatePercent:
        input.zonaFrancaRatePercent ?? this.costSettings.zonaFrancaRatePercent,
      transportFee: input.transportFee ?? this.costSettings.transportFee,
      dollarRate: input.dollarRate ?? this.costSettings.dollarRate,
      updatedAt: new Date()
    };

    if (companyId) {
      const nextCompanySettings = {
        companyId,
        silverPricePerGram: input.silverPricePerGram ?? current.silverPricePerGram,
        zonaFrancaRatePercent:
          input.zonaFrancaRatePercent ?? current.zonaFrancaRatePercent,
        transportFee: input.transportFee ?? current.transportFee,
        dollarRate: input.dollarRate ?? current.dollarRate,
        updatedAt: new Date()
      };
      const history = this.companyCostSettingsHistory.get(companyId) ?? [];
      history.unshift({
        id: randomUUID(),
        companyId,
        previousSilverPricePerGram: current.silverPricePerGram,
        nextSilverPricePerGram: nextCompanySettings.silverPricePerGram,
        previousZonaFrancaRatePercent: current.zonaFrancaRatePercent,
        nextZonaFrancaRatePercent: nextCompanySettings.zonaFrancaRatePercent,
        previousTransportFee: current.transportFee,
        nextTransportFee: nextCompanySettings.transportFee,
        previousDollarRate: current.dollarRate,
        nextDollarRate: nextCompanySettings.dollarRate,
        changedFields: [],
        createdAt: new Date()
      });
      this.companyCostSettingsHistory.set(companyId, history);
      this.companyCostSettings.set(companyId, nextCompanySettings);
      return nextCompanySettings;
    }

    return this.costSettings;
  }

  async listCostSettingsHistory(limit = 50, companyId) {
    if (companyId) {
      return (this.companyCostSettingsHistory.get(companyId) ?? []).slice(0, limit);
    }

    return [];
  }

  async listEffectiveInventoryByCompany(companyId) {
    return [...this.masterProducts.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((product) => {
        const companyInventory = this.companyInventory.get(`${companyId}:${product.id}`) ?? null;
        const variants = (product.variants ?? []).map((variant) => {
          const variantInventory =
            this.companyVariantInventory.get(`${companyId}:${variant.id}`) ?? null;

          return {
            variantId: variant.id,
            productId: variant.productId,
            sku: variant.sku,
            individualWeight: variant.individualWeight ?? null,
            masterStock: variant.individualStock ?? 0,
            customStockQuantity: variantInventory?.customStockQuantity ?? null,
            effectiveStockQuantity:
              variantInventory?.customStockQuantity ?? variant.individualStock ?? 0,
            updatedAt: variantInventory?.updatedAt ?? variant.updatedAt
          };
        });
        const hasVariantInventory = variants.some(
          (variant) => variant.customStockQuantity !== null
        );
        const masterStockFromVariants =
          variants.length > 0
            ? variants.reduce((sum, variant) => sum + variant.masterStock, 0)
            : product.masterStock;
        const effectiveStockFromVariants =
          variants.reduce((sum, variant) => sum + variant.effectiveStockQuantity, 0);
        const latestVariantUpdate = variants.reduce(
          (latest, variant) => (!latest || variant.updatedAt > latest ? variant.updatedAt : latest),
          null
        );

        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          masterStock: masterStockFromVariants,
          customStockQuantity: companyInventory?.customStockQuantity ?? null,
          variantStockQuantityTotal: hasVariantInventory ? effectiveStockFromVariants : null,
          hasVariantInventory,
          effectiveStockQuantity: hasVariantInventory
            ? effectiveStockFromVariants
            : companyInventory?.customStockQuantity ?? masterStockFromVariants,
          updatedAt: hasVariantInventory
            ? latestVariantUpdate ?? companyInventory?.updatedAt ?? product.updatedAt
            : companyInventory?.updatedAt ?? product.updatedAt,
          variants
        };
      });
  }

  async upsertCompanyInventory(companyId, productId, customStockQuantity) {
    const product = this.masterProducts.get(productId);
    if (!product) {
      return null;
    }

    const record = {
      id: randomUUID(),
      companyId,
      productId,
      customStockQuantity,
      updatedAt: new Date()
    };

    this.companyInventory.set(`${companyId}:${productId}`, record);

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      masterStock: product.masterStock,
      customStockQuantity: record.customStockQuantity,
      variantStockQuantityTotal: null,
      hasVariantInventory: false,
      effectiveStockQuantity: record.customStockQuantity,
      updatedAt: record.updatedAt,
      variants: (product.variants ?? []).map((variant) => {
        const variantInventory =
          this.companyVariantInventory.get(`${companyId}:${variant.id}`) ?? null;

        return {
          variantId: variant.id,
          productId: variant.productId,
          sku: variant.sku,
          individualWeight: variant.individualWeight ?? null,
          masterStock: variant.individualStock ?? 0,
          customStockQuantity: variantInventory?.customStockQuantity ?? null,
          effectiveStockQuantity:
            variantInventory?.customStockQuantity ?? variant.individualStock ?? 0,
          updatedAt: variantInventory?.updatedAt ?? variant.updatedAt
        };
      })
    };
  }

  async deleteCompanyInventory(companyId, productId) {
    this.companyInventory.delete(`${companyId}:${productId}`);
  }

  async upsertCompanyVariantInventory(companyId, variantId, customStockQuantity) {
    this.companyVariantInventory.set(`${companyId}:${variantId}`, {
      customStockQuantity,
      updatedAt: new Date()
    });
  }
}

class FakeProductCacheStore {
  constructor() {
    this.entries = new Map();
  }

  async get(key) {
    const value = this.entries.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value) {
    this.entries.set(key, JSON.stringify(value));
  }

  async delete(key) {
    this.entries.delete(key);
  }
}

class FakeRateLimitCounterStore {
  constructor() {
    this.counters = new Map();
  }

  async increment(key) {
    const nextValue = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, nextValue);
    return nextValue;
  }
}

class FakeProductGateway {
  constructor(products, laborRateTables = null, productTypes = null) {
    this.products = products;
    this.laborRateTables = laborRateTables;
    this.productTypes = productTypes;
    this.error = null;
  }

  async listProducts() {
    if (this.error) {
      throw this.error;
    }

    return this.products;
  }

  async listLaborRateTables() {
    if (this.laborRateTables) {
      return this.laborRateTables;
    }

    const uniqueNames = [
      ...new Set(
        this.products
          .map((product) => product.laborRateTableName ?? product.labor_rate_table_name ?? null)
          .filter((name) => Boolean(name))
      )
    ];

    return uniqueNames.map((name) => ({
      id: `labor-rate-table:${name}`,
      name,
      nome: name,
      label: name
    }));
  }

  async listProductTypes() {
    if (this.productTypes) {
      return this.productTypes;
    }

    const seen = new Map();
    for (const product of this.products) {
      const id = product.typeId ?? product.type_id ?? null;
      const name = product.productType ?? product.tipo ?? product.material ?? product.material_base ?? null;
      if (!id || !name || seen.has(id)) {
        continue;
      }

      const material = product.material ?? product.baseMaterial ?? product.material_base ?? name;
      seen.set(id, {
        id,
        name,
        nome: name,
        label: name,
        material,
        baseMaterial: material,
        material_base: material,
        purity: product.purity ?? product.pureza ?? null,
        pureza: product.purity ?? product.pureza ?? null
      });
    }

    return [...seen.values()];
  }

  async updateProduct(input) {
    const product = this.products.find((item) => item.id === input.id);
    if (!product) {
      throw new Error("Product not found");
    }

    const updated = {
      ...product,
      code: input.sku,
      sku: input.sku,
      numero_serie: input.sku,
      name: input.name,
      nome: input.name,
      serialNumber: input.sku,
      availableQuantity: input.availableQuantity,
      stock_quantity: input.availableQuantity
    };

    this.products = this.products.map((item) => (item.id === input.id ? updated : item));
    return updated;
  }
}

class FakeProductMediaService {
  async getObjectByStorageKey(storageKey) {
    return {
      body: Readable.from([`media:${storageKey}`]),
      cacheControl: "public, max-age=31536000, immutable",
      contentLength: null,
      contentType: "image/jpeg",
      etag: null,
      lastModified: null
    };
  }
}

function createMockSupabaseClient(rowsByTable) {
  return {
    from(tableName) {
      let selectedRows = [...(rowsByTable[tableName] ?? [])];

      const builder = {
        select() {
          return builder;
        },
        order() {
          return builder;
        },
        in(column, values) {
          selectedRows = selectedRows.filter((row) => values.includes(row[column]));
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: selectedRows,
            error: null
          }).then(resolve, reject);
        }
      };

      return builder;
    }
  };
}

async function createTestApp(options = {}) {
  const env = createTestEnv(options.env);
  const controlPlane = options.controlPlane ?? new FakeControlPlaneRepository();
  const productCache = options.productCache ?? new FakeProductCacheStore();
  const rateLimitCounter = options.rateLimitCounter ?? new FakeRateLimitCounterStore();
  const productMediaService = options.productMediaService ?? new FakeProductMediaService();
  const productGateway =
    options.productGateway ??
    new FakeProductGateway([
      {
        variants: [
          {
            variant_id: "variant-1",
            variantId: "variant-1",
            product_id: "prod-1",
            productId: "prod-1",
            sku: "SKU-001-ARO-16",
            individual_weight: "10.5",
            individualWeight: "10.5",
            individual_stock: 4,
            individualStock: 4,
            size_labels: ["ARO 16"],
            sizeLabels: ["ARO 16"],
            color_labels: ["PRATA"],
            colorLabels: ["PRATA"],
            options: [
              {
                id: "option-size-1",
                kind: "size",
                label: "ARO 16"
              },
              {
                id: "option-color-1",
                kind: "color",
                label: "PRATA"
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
        description: null,
        descricao: null,
        category: null,
        categoria: null,
        subcategory: null,
        subcategoria: null,
        material: null,
        baseMaterial: null,
        material_base: null,
        purity: null,
        pureza: null,
        weight_grams: "10.5",
        weightGrams: "10.5",
        peso_gramas: "10.5",
        bathType: null,
        tipo_banho: null,
        status: null,
        bronzeImageKey: "joias/raw/SKU-001/SKU-001_st.jpg",
        s3_key_bronze: "joias/raw/SKU-001/SKU-001_st.jpg",
        silverImageKey: null,
        s3_key_silver: null,
        media_assets: [
          {
            id: "media-1",
            role: "st",
            storage_key: "joias/raw/SKU-001/SKU-001_st.jpg",
            storageKey: "joias/raw/SKU-001/SKU-001_st.jpg",
            sort_order: 0,
            sortOrder: 0,
            url: null,
            created_at: "2026-03-23T00:00:00.000Z",
            createdAt: "2026-03-23T00:00:00.000Z"
          }
        ],
        mediaAssets: [
          {
            id: "media-1",
            role: "st",
            storage_key: "joias/raw/SKU-001/SKU-001_st.jpg",
            storageKey: "joias/raw/SKU-001/SKU-001_st.jpg",
            sort_order: 0,
            sortOrder: 0,
            url: null,
            created_at: "2026-03-23T00:00:00.000Z",
            createdAt: "2026-03-23T00:00:00.000Z"
          }
        ],
        supplierCode: null,
        supplier_code: null,
        supplierId: null,
        supplier_id: null,
        supplierName: null,
        supplier_name: null,
        supplierProductSku: null,
        supplier_product_sku: null,
        fiscalCode: null,
        fiscal_code: null,
        categoryId: null,
        category_id: null,
        productType: null,
        tipo: null,
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
        availableQuantity: 10,
        available_quantity: null,
        stock_quantity: 10,
        ncm: null,
        laborRateTableId: null,
        labor_rate_table_id: null,
        laborRateTableName: null,
        labor_rate_table_name: null,
        createdAt: null,
        created_at: null,
        price: 99.9,
        updatedAt: "2026-03-23T00:00:00.000Z",
        updated_at: "2026-03-23T00:00:00.000Z"
      }
    ]);

  const app = await buildApp({
    env,
    controlPlane,
    productCache,
    rateLimitCounter,
    productGateway,
    productMediaService
  });

  return {
    app,
    env,
    controlPlane,
    productCache,
    rateLimitCounter,
    productGateway,
    productMediaService
  };
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    return false;
  }
}

const cases = [
  {
    name: "Supabase gateway resolves material and purity from product_types",
    fn: async () => {
      const gateway = new SupabaseProductGateway(
        createMockSupabaseClient({
          products: [
            {
              id: "prod-material-1",
              sku: "MAT-001",
              numero_serie: "MAT-001",
              nome: "Anel Material",
              material_base: "Material legado",
              tipo: "Tipo legado",
              type_id: "type-prata-925",
              labor_rate_table_id: "lrt-1",
              labor_rate_table_name: null,
              pureza: null,
              stock_quantity: 3,
              available_quantity: 3
            }
          ],
          product_variants: [],
          product_media_assets: [],
          suppliers: [],
          product_types: [
            {
              id: "type-prata-925",
              nome: "Prata 925",
              material_base: "Prata 925",
              pureza: "925"
            }
          ],
          labor_rate_tables: [
            {
              id: "lrt-1",
              nome: "Peças especiais"
            },
            {
              id: "lrt-2",
              nome: "Correntes"
            }
          ]
        }),
        "products"
      );

      const products = await gateway.listProducts();
      const laborRateTables = await gateway.listLaborRateTables();
      const productTypes = await gateway.listProductTypes();

      assert.equal(products.length, 1);
      assert.equal(products[0].material, "Prata 925");
      assert.equal(products[0].baseMaterial, "Prata 925");
      assert.equal(products[0].material_base, "Prata 925");
      assert.equal(products[0].productType, "Prata 925");
      assert.equal(products[0].tipo, "Prata 925");
      assert.equal(products[0].purity, "925");
      assert.equal(products[0].pureza, "925");
      assert.equal(products[0].laborRateTableName, "Peças especiais");
      assert.equal(products[0].labor_rate_table_name, "Peças especiais");
      assert.deepEqual(productTypes, [
        {
          id: "type-prata-925",
          name: "Prata 925",
          nome: "Prata 925",
          label: "Prata 925",
          material: "Prata 925",
          baseMaterial: "Prata 925",
          material_base: "Prata 925",
          purity: "925",
          pureza: "925"
        }
      ]);
      assert.deepEqual(
        laborRateTables.map((item) => item.name).sort((left, right) => left.localeCompare(right, "pt-BR")),
        ["Correntes", "Peças especiais"]
      );
    }
  },
  {
    name: "ApiKeyService authenticates valid API keys",
    fn: async () => {
      const env = createTestEnv();
      const repo = new FakeControlPlaneRepository();
      const company = repo.seedCompany({
        legalName: "Empresa Teste",
        externalCode: "empresa-teste"
      });
      const plaintextKey = "b2b_valid_key_123";

      repo.seedApiKey({
        companyId: company.id,
        keyPrefix: deriveApiKeyPrefix(plaintextKey),
        keyHash: hashApiKey(plaintextKey, env.API_KEY_PEPPER),
        rateLimitPerMinute: 30
      });

      const service = new ApiKeyService(repo, env.API_KEY_PEPPER);
      const authContext = await service.authenticatePresentedKey(plaintextKey);

      assert.equal(authContext.companyId, company.id);
      assert.equal(authContext.rateLimitPerMinute, 30);
    }
  },
  {
    name: "ApiKeyService rejects revoked keys",
    fn: async () => {
      const env = createTestEnv();
      const repo = new FakeControlPlaneRepository();
      const company = repo.seedCompany({
        legalName: "Empresa Teste",
        externalCode: "empresa-teste"
      });
      const plaintextKey = "b2b_revoked_key_123";

      repo.seedApiKey({
        companyId: company.id,
        keyPrefix: deriveApiKeyPrefix(plaintextKey),
        keyHash: hashApiKey(plaintextKey, env.API_KEY_PEPPER),
        rateLimitPerMinute: 30,
        isRevoked: true
      });

      const service = new ApiKeyService(repo, env.API_KEY_PEPPER);
      await assert.rejects(service.authenticatePresentedKey(plaintextKey), {
        code: "API_KEY_REVOKED",
        statusCode: 403
      });
    }
  },
  {
    name: "ProductsService caches upstream data",
    fn: async () => {
      const env = createTestEnv();
      const cacheStore = new FakeProductCacheStore();
      const controlPlane = new FakeControlPlaneRepository();
      const productGateway = new FakeProductGateway([
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
          description: null,
          descricao: null,
          category: null,
          categoria: null,
          subcategory: null,
          subcategoria: null,
          material: null,
          baseMaterial: null,
          material_base: null,
          purity: null,
          pureza: null,
          weight_grams: "5.5",
          weightGrams: "5.5",
          peso_gramas: "5.5",
          bathType: null,
          tipo_banho: null,
          status: null,
          bronzeImageKey: "joias/raw/SKU-001/SKU-001_st.jpg",
          s3_key_bronze: "joias/raw/SKU-001/SKU-001_st.jpg",
          silverImageKey: null,
          s3_key_silver: null,
          media_assets: [
            {
              id: "media-1",
              role: "st",
              storage_key: "joias/raw/SKU-001/SKU-001_st.jpg",
              storageKey: "joias/raw/SKU-001/SKU-001_st.jpg",
              sort_order: 0,
              sortOrder: 0,
              url: null,
              created_at: "2026-03-23T00:00:00.000Z",
              createdAt: "2026-03-23T00:00:00.000Z"
            }
          ],
          mediaAssets: [
            {
              id: "media-1",
              role: "st",
              storage_key: "joias/raw/SKU-001/SKU-001_st.jpg",
              storageKey: "joias/raw/SKU-001/SKU-001_st.jpg",
              sort_order: 0,
              sortOrder: 0,
              url: null,
              created_at: "2026-03-23T00:00:00.000Z",
              createdAt: "2026-03-23T00:00:00.000Z"
            }
          ],
          supplierCode: null,
          supplier_code: null,
          supplierId: null,
          supplier_id: null,
          supplierName: null,
          supplier_name: null,
          supplierProductSku: null,
          supplier_product_sku: null,
          fiscalCode: null,
          fiscal_code: null,
          categoryId: null,
          category_id: null,
          productType: null,
          tipo: null,
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
          createdAt: null,
          created_at: null,
          price: 10,
          updatedAt: "2026-03-23T00:00:00.000Z",
          updated_at: "2026-03-23T00:00:00.000Z"
        }
      ]);

      const service = new ProductsService({ env, cacheStore, productGateway, controlPlane });
      const firstResponse = await service.listProducts();
      const secondResponse = await service.listProducts();

      assert.equal(firstResponse.meta.source, "upstream");
      assert.equal(
        firstResponse.data[0].main_image_url,
        "https://api.example.com/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg"
      );
      assert.equal(
        firstResponse.data[0].media_assets[0].url,
        "https://api.example.com/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg"
      );
      assert.equal(secondResponse.meta.source, "cache");
    }
  },
  {
    name: "ProductsService serves stale cache",
    fn: async () => {
      const env = createTestEnv({
        PRODUCTS_CACHE_TTL_SECONDS: 1,
        PRODUCTS_CACHE_STALE_SECONDS: 300
      });
      const cacheStore = new FakeProductCacheStore();
      const controlPlane = new FakeControlPlaneRepository();
      const productGateway = new FakeProductGateway([]);

      await cacheStore.set(buildProductsCacheKey(), {
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
            description: null,
            descricao: null,
          category: null,
          categoria: null,
          subcategory: null,
          subcategoria: null,
          material: null,
          baseMaterial: null,
          material_base: null,
          purity: null,
          pureza: null,
          weight_grams: "5.5",
          weightGrams: "5.5",
          peso_gramas: "5.5",
            bathType: null,
            tipo_banho: null,
            status: null,
            bronzeImageKey: null,
            s3_key_bronze: null,
            silverImageKey: null,
            s3_key_silver: null,
            supplierCode: null,
            supplier_code: null,
            supplierId: null,
            supplier_id: null,
            supplierName: null,
            supplier_name: null,
            supplierProductSku: null,
            supplier_product_sku: null,
            fiscalCode: null,
            fiscal_code: null,
            categoryId: null,
            category_id: null,
            productType: "Prata 925",
            tipo: "Prata 925",
            typeId: "type-prata-925",
            type_id: "type-prata-925",
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
            createdAt: null,
            created_at: null,
            price: 10,
            updatedAt: "2026-03-23T00:00:00.000Z",
            updated_at: "2026-03-23T00:00:00.000Z"
          }
        ]
      });

      productGateway.error = new Error("Supabase unavailable");

      const service = new ProductsService({ env, cacheStore, productGateway, controlPlane });
      const response = await service.listProducts();

      assert.equal(response.meta.source, "cache");
      assert.equal(response.meta.stale, true);
    }
  },
    {
      name: "Cost calculator uses direct silver value before zona franca and dollar conversion",
      fn: async () => {
        const result = calculateProductCost(
          {
            weightGrams: "0.80",
            laborCost: "1.50"
          },
          {
            companyId: null,
            silverPricePerGram: 2.21,
            zonaFrancaRatePercent: 6,
            transportFee: 0.1,
            dollarRate: 5.28,
            updatedAt: new Date("2026-03-27T00:00:00.000Z")
          }
        );

        assert.deepEqual(result, {
          laborCostUsd: 1.5,
          laborCostBrl: 7.92,
          silverCost: 2.21,
          r1: 3.71,
          r2: 3.93,
          r3: 4.03,
          finalCost: 21.29
        });
      }
    },
  {
    name: "Products endpoint exposes stable media URLs and proxy route streams content",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Media",
          externalCode: "empresa-media"
        });
        const apiKey = "b2b_media_catalog_123";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 10
        });

        const productsResponse = await app.inject({
          method: "GET",
          url: "/api/v1/products",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(productsResponse.statusCode, 200);
        assert.equal(
          productsResponse.json().data[0].main_image_url,
          "https://api.example.com/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg"
        );
        assert.equal(
          productsResponse.json().data[0].media_assets[0].url,
          "https://api.example.com/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg"
        );
        assert.equal(productsResponse.json().data[0].variantCount, 1);
        assert.equal(productsResponse.json().data[0].variant_count, 1);
        assert.equal(productsResponse.json().data[0].variants[0].stockWeightGrams, 4);
        assert.equal(productsResponse.json().data[0].variants[0].stockUnits, 0);
        assert.equal(productsResponse.json().data[0].variants[0].cost, 60.9);

        const mediaResponse = await app.inject({
          method: "GET",
          url: "/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg"
        });

        assert.equal(mediaResponse.statusCode, 200);
        assert.equal(mediaResponse.headers["content-type"], "image/jpeg");
        assert.equal(
          mediaResponse.headers["cache-control"],
          "public, max-age=31536000, immutable"
        );
        assert.equal(mediaResponse.body, "media:joias/raw/SKU-001/SKU-001_st.jpg");
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Products endpoint exposes all labor rate tables in response meta",
    fn: async () => {
      const productGateway = new FakeProductGateway(
        [
          {
            variants: [],
            id: "prod-labor-1",
            product_id: "prod-labor-1",
            code: "LAB-001",
            sku: "LAB-001",
            numero_serie: "LAB-001",
            name: "Produto Labor",
            nome: "Produto Labor",
            serialNumber: "LAB-001",
            description: null,
            descricao: null,
            category: null,
            categoria: null,
            subcategory: null,
            subcategoria: null,
            material: null,
            baseMaterial: null,
            material_base: null,
            purity: null,
            pureza: null,
            weight_grams: null,
            weightGrams: null,
            peso_gramas: null,
            bathType: null,
            tipo_banho: null,
            status: null,
            bronzeImageKey: null,
            s3_key_bronze: null,
            silverImageKey: null,
            s3_key_silver: null,
            media_assets: [],
            mediaAssets: [],
            supplierCode: null,
            supplier_code: null,
            supplierId: null,
            supplier_id: null,
            supplierName: null,
            supplier_name: null,
            supplierProductSku: null,
            supplier_product_sku: null,
            fiscalCode: null,
            fiscal_code: null,
            categoryId: null,
            category_id: null,
            productType: "Prata 925",
            tipo: "Prata 925",
            typeId: "type-prata-925",
            type_id: "type-prata-925",
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
            available_quantity: 1,
            stock_quantity: 1,
            ncm: null,
            laborRateTableId: "lrt-1",
            labor_rate_table_id: "lrt-1",
            laborRateTableName: "Peças (padrão)",
            labor_rate_table_name: "Peças (padrão)",
            createdAt: null,
            created_at: null,
            price: null,
            updatedAt: null,
            updated_at: null
          }
        ],
        [
          { id: "lrt-3", name: "Alianças com filete de ouro", nome: "Alianças com filete de ouro", label: "Alianças com filete de ouro" },
          { id: "lrt-2", name: "Correntes", nome: "Correntes", label: "Correntes" },
          { id: "lrt-1", name: "Peças (padrão)", nome: "Peças (padrão)", label: "Peças (padrão)" },
          { id: "lrt-4", name: "Peças de pedra natural", nome: "Peças de pedra natural", label: "Peças de pedra natural" },
          { id: "lrt-5", name: "Peças especiais", nome: "Peças especiais", label: "Peças especiais" }
        ],
        [
          {
            id: "type-prata-925",
            name: "Prata 925",
            nome: "Prata 925",
            label: "Prata 925",
            material: "Prata 925",
            baseMaterial: "Prata 925",
            material_base: "Prata 925",
            purity: "925",
            pureza: "925"
          }
        ]
      );
      const { app, controlPlane, env } = await createTestApp({ productGateway });
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Tabelas",
          externalCode: "empresa-tabelas"
        });
        const apiKey = "b2b_labor_tables_123";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 10
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/v1/products",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(response.statusCode, 200);
        assert.deepEqual(response.json().meta.laborRateTables.map((item) => item.name), [
          "Alianças com filete de ouro",
          "Correntes",
          "Peças (padrão)",
          "Peças de pedra natural",
          "Peças especiais"
        ]);
        assert.deepEqual(response.json().meta.materialTypes, [
          {
            id: "type-prata-925",
            name: "Prata 925",
            nome: "Prata 925",
            label: "Prata 925",
            material: "Prata 925",
            baseMaterial: "Prata 925",
            material_base: "Prata 925",
            purity: "925",
            pureza: "925",
            laborRateTables: [
              {
                id: "lrt-1",
                name: "Peças (padrão)",
                nome: "Peças (padrão)",
                label: "Peças (padrão)"
              }
            ]
          }
        ]);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Company catalog endpoint exposes company-scoped stock, costs, and consolidated variants",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Catalogo",
          externalCode: "empresa-catalogo"
        });
        const apiKey = "b2b_company_catalog_123";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 10
        });

        await controlPlane.updateCostSettings(
          {
            silverPricePerGram: 2,
            zonaFrancaRatePercent: 0,
            transportFee: 0,
            dollarRate: 5
          },
          company.id
        );

        await controlPlane.replaceMasterProducts([
          {
            id: "prod-1",
            sku: "SKU-001",
            name: "Produto 1",
            masterStock: 4,
            updatedAt: new Date("2026-03-23T00:00:00.000Z"),
            variants: [
              {
                id: "variant-1",
                productId: "prod-1",
                sku: "SKU-001-ARO-16",
                individualWeight: 10.5,
                individualStock: 4,
                createdAt: new Date("2026-03-23T00:00:00.000Z"),
                updatedAt: new Date("2026-03-23T00:00:00.000Z")
              }
            ]
          }
        ]);

        await controlPlane.upsertCompanyInventory(company.id, "prod-1", 21);
        await controlPlane.upsertCompanyVariantInventory(company.id, "variant-1", 21);

        const response = await app.inject({
          method: "GET",
          url: "/api/v1/companyid",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.json().company.id, company.id);
        assert.equal(response.json().company.companyId, company.id);
        assert.equal(response.json().company.legalName, "Empresa Catalogo");
        assert.equal(response.json().meta.companyId, company.id);
        assert.equal(response.json().meta.companyExternalCode, "empresa-catalogo");
        assert.equal(response.json().data[0].main_image_url, "https://api.example.com/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg");
        assert.equal(response.json().data[0].variantCount, 1);
        assert.equal(response.json().data[0].variant_count, 1);
        assert.equal(response.json().data[0].availableQuantity, 21);
        assert.equal(response.json().data[0].available_quantity, 21);
        assert.equal(response.json().data[0].stock_quantity, 21);
        assert.equal(response.json().data[0].masterStock, 4);
        assert.equal(response.json().data[0].customStockQuantity, 21);
        assert.equal(response.json().data[0].variantStockQuantityTotal, 21);
        assert.equal(response.json().data[0].hasVariantInventory, true);
        assert.equal(response.json().data[0].effectiveStockQuantity, 21);
        assert.equal(response.json().data[0].costFinal, 10);
        assert.deepEqual(response.json().data[0].costBreakdown, {
          laborCostUsd: 0,
          laborCostBrl: 0,
          silverCost: 2,
          r1: 2,
          r2: 2,
          r3: 2,
          finalCost: 10
        });
        assert.equal(response.json().data[0].variants[0].individualStock, 21);
        assert.equal(response.json().data[0].variants[0].masterStock, 4);
        assert.equal(response.json().data[0].variants[0].customStockQuantity, 21);
        assert.equal(response.json().data[0].variants[0].effectiveStockQuantity, 21);
        assert.equal(response.json().data[0].variants[0].stockWeightGrams, 21);
        assert.equal(response.json().data[0].variants[0].stockUnits, 2);
        assert.equal(response.json().data[0].variants[0].cost, 105);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Products endpoint rejects missing bearer token",
    fn: async () => {
      const { app } = await createTestApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/products"
        });
        assert.equal(response.statusCode, 401);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Products endpoint rejects inactive companies",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Inativa",
          externalCode: "empresa-inativa",
          isActive: false
        });
        const apiKey = "b2b_company_inactive_123";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 10
        });

        const response = await app.inject({
          method: "GET",
          url: "/api/v1/products",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(response.statusCode, 403);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Products endpoint applies rate limiting",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Limitada",
          externalCode: "empresa-limitada"
        });
        const apiKey = "b2b_rate_limit_123";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 1
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
        assert.equal(secondResponse.statusCode, 429);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Partner inventory returns isolated stock per company",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const companyA = controlPlane.seedCompany({
          legalName: "Empresa A",
          externalCode: "empresa-a"
        });
        const companyB = controlPlane.seedCompany({
          legalName: "Empresa B",
          externalCode: "empresa-b"
        });
        const apiKeyA = "b2b_inventory_company_a";
        const apiKeyB = "b2b_inventory_company_b";

        controlPlane.seedApiKey({
          companyId: companyA.id,
          keyPrefix: deriveApiKeyPrefix(apiKeyA),
          keyHash: hashApiKey(apiKeyA, env.API_KEY_PEPPER),
          rateLimitPerMinute: 20
        });
        controlPlane.seedApiKey({
          companyId: companyB.id,
          keyPrefix: deriveApiKeyPrefix(apiKeyB),
          keyHash: hashApiKey(apiKeyB, env.API_KEY_PEPPER),
          rateLimitPerMinute: 20
        });

        await controlPlane.replaceMasterProducts([
          {
            id: "prod-1",
            sku: "SKU-001",
            name: "Produto Multi-Tenant",
            masterStock: 15,
            updatedAt: new Date("2026-03-24T00:00:00.000Z")
          }
        ]);

        await controlPlane.upsertCompanyInventory(companyA.id, "prod-1", 3);
        await controlPlane.upsertCompanyInventory(companyB.id, "prod-1", 9);

        const companyAResponse = await app.inject({
          method: "GET",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKeyA}`
          }
        });
        const companyBResponse = await app.inject({
          method: "GET",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKeyB}`
          }
        });

        assert.equal(companyAResponse.statusCode, 200);
        assert.equal(companyBResponse.statusCode, 200);
        assert.equal(companyAResponse.json().data[0].effectiveStockQuantity, 3);
        assert.equal(companyBResponse.json().data[0].effectiveStockQuantity, 9);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Partner inventory sync accepts batch updates by sku and returns item errors",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Sync",
          externalCode: "empresa-sync"
        });
        const apiKey = "b2b_inventory_sync_key";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 20
        });

        await controlPlane.replaceMasterProducts([
          {
            id: "prod-sync-1",
            sku: "SYNC-001",
            name: "Produto Sync 1",
            masterStock: 8,
            updatedAt: new Date("2026-03-24T00:00:00.000Z")
          },
          {
            id: "prod-sync-2",
            sku: "SYNC-002",
            name: "Produto Sync 2",
            masterStock: 11,
            updatedAt: new Date("2026-03-24T00:00:00.000Z")
          }
        ]);

        const syncResponse = await app.inject({
          method: "POST",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          },
          payload: {
            items: [
              {
                sku: "SYNC-001",
                custom_stock_quantity: 14
              },
              {
                code: "SYNC-002",
                custom_stock_quantity: 5
              },
              {
                numero_serie: "SYNC-404",
                custom_stock_quantity: 1
              }
            ]
          }
        });

        assert.equal(syncResponse.statusCode, 200);
        assert.equal(syncResponse.json().meta.receivedCount, 3);
        assert.equal(syncResponse.json().meta.updatedCount, 2);
        assert.equal(syncResponse.json().meta.errorCount, 1);
        assert.equal(syncResponse.json().data[0].sku, "SYNC-001");
        assert.equal(syncResponse.json().data[0].customStockQuantity, 14);
        assert.equal(syncResponse.json().data[1].sku, "SYNC-002");
        assert.equal(syncResponse.json().data[1].customStockQuantity, 5);
        assert.equal(syncResponse.json().errors[0].numeroSerie, "SYNC-404");

        const getResponse = await app.inject({
          method: "GET",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(getResponse.statusCode, 200);
        assert.equal(getResponse.json().data[0].customStockQuantity, 14);
        assert.equal(getResponse.json().data[1].customStockQuantity, 5);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Partner inventory sync accepts variant stock and returns summed product stock",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Variantes",
          externalCode: "empresa-variantes"
        });
        const apiKey = "b2b_inventory_variants_key";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 20
        });

        await controlPlane.replaceMasterProducts([
          {
            id: "prod-variant-1",
            sku: "VAR-001",
            name: "Produto Variado",
            masterStock: 20,
            updatedAt: new Date("2026-03-24T00:00:00.000Z"),
            variants: [
              {
                id: "variant-a",
                productId: "prod-variant-1",
                sku: "VAR-001-A",
                individualWeight: 1.1,
                individualStock: 4,
                createdAt: new Date("2026-03-24T00:00:00.000Z"),
                updatedAt: new Date("2026-03-24T00:00:00.000Z")
              },
              {
                id: "variant-b",
                productId: "prod-variant-1",
                sku: "VAR-001-B",
                individualWeight: 1.3,
                individualStock: 6,
                createdAt: new Date("2026-03-24T00:00:00.000Z"),
                updatedAt: new Date("2026-03-24T00:00:00.000Z")
              }
            ]
          }
        ]);

        const syncResponse = await app.inject({
          method: "POST",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          },
          payload: {
            items: [
              {
                sku: "VAR-001",
                variants: [
                  {
                    sku: "VAR-001-A",
                    custom_stock_quantity: 9
                  },
                  {
                    variant_id: "variant-b",
                    custom_stock_quantity: 3
                  }
                ]
              }
            ]
          }
        });

        assert.equal(syncResponse.statusCode, 200);
        assert.equal(syncResponse.json().meta.updatedCount, 1);
        assert.equal(syncResponse.json().data[0].effectiveStockQuantity, 12);
        assert.equal(syncResponse.json().data[0].customStockQuantity, null);
        assert.equal(syncResponse.json().data[0].variantStockQuantityTotal, 12);
        assert.equal(syncResponse.json().data[0].hasVariantInventory, true);
        assert.equal(syncResponse.json().data[0].variants.length, 2);
        assert.equal(syncResponse.json().data[0].variants[0].effectiveStockQuantity, 9);
        assert.equal(syncResponse.json().data[0].variants[1].effectiveStockQuantity, 3);

        const getResponse = await app.inject({
          method: "GET",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(getResponse.statusCode, 200);
        assert.equal(getResponse.json().data[0].masterStock, 10);
        assert.equal(getResponse.json().data[0].customStockQuantity, null);
        assert.equal(getResponse.json().data[0].variantStockQuantityTotal, 12);
        assert.equal(getResponse.json().data[0].effectiveStockQuantity, 12);
        assert.equal(getResponse.json().data[0].variants[0].sku, "VAR-001-A");
        assert.equal(getResponse.json().data[0].variants[0].customStockQuantity, 9);
        assert.equal(getResponse.json().data[0].variants[0].stockWeightGrams, 9);
        assert.equal(getResponse.json().data[0].variants[0].stockUnits, 8);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Partner variant sync clears stale parent custom stock when only variants are sent",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Variantes Limpeza",
          externalCode: "empresa-variantes-limpeza"
        });
        const apiKey = "b2b_inventory_variant_cleanup_key";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 20
        });

        await controlPlane.replaceMasterProducts([
          {
            id: "prod-variant-clean-1",
            sku: "VAR-CLEAN-001",
            name: "Produto Variado Limpeza",
            masterStock: 20,
            updatedAt: new Date("2026-03-24T00:00:00.000Z"),
            variants: [
              {
                id: "variant-clean-a",
                productId: "prod-variant-clean-1",
                sku: "VAR-CLEAN-001-A",
                individualWeight: 1.1,
                individualStock: 4,
                createdAt: new Date("2026-03-24T00:00:00.000Z"),
                updatedAt: new Date("2026-03-24T00:00:00.000Z")
              },
              {
                id: "variant-clean-b",
                productId: "prod-variant-clean-1",
                sku: "VAR-CLEAN-001-B",
                individualWeight: 1.3,
                individualStock: 6,
                createdAt: new Date("2026-03-24T00:00:00.000Z"),
                updatedAt: new Date("2026-03-24T00:00:00.000Z")
              }
            ]
          }
        ]);

        const seedParentResponse = await app.inject({
          method: "POST",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          },
          payload: {
            items: [
              {
                sku: "VAR-CLEAN-001",
                custom_stock_quantity: 20
              }
            ]
          }
        });

        assert.equal(seedParentResponse.statusCode, 200);
        assert.equal(seedParentResponse.json().data[0].customStockQuantity, 20);

        const variantSyncResponse = await app.inject({
          method: "POST",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          },
          payload: {
            items: [
              {
                sku: "VAR-CLEAN-001",
                variants: [
                  {
                    sku: "VAR-CLEAN-001-A",
                    custom_stock_quantity: 5
                  },
                  {
                    sku: "VAR-CLEAN-001-B",
                    custom_stock_quantity: 8
                  }
                ]
              }
            ]
          }
        });

        assert.equal(variantSyncResponse.statusCode, 200);
        assert.equal(variantSyncResponse.json().data[0].customStockQuantity, null);
        assert.equal(variantSyncResponse.json().data[0].variantStockQuantityTotal, 13);
        assert.equal(variantSyncResponse.json().data[0].effectiveStockQuantity, 13);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Sync webhook refreshes local master catalog",
    fn: async () => {
      const productGateway = new FakeProductGateway([
        {
          variants: [],
          id: "prod-sync-1",
          product_id: "prod-sync-1",
          code: "SYNC-001",
          sku: "SYNC-001",
          numero_serie: "SYNC-001",
          name: "Produto Sincronizado",
          nome: "Produto Sincronizado",
          serialNumber: "SYNC-001",
          description: null,
          descricao: null,
          category: null,
          categoria: null,
          subcategory: null,
          subcategoria: null,
          material: null,
          baseMaterial: null,
          material_base: null,
          purity: null,
          pureza: null,
          weight_grams: null,
          weightGrams: null,
          peso_gramas: null,
          bathType: null,
          tipo_banho: null,
          status: null,
          bronzeImageKey: null,
          s3_key_bronze: null,
          silverImageKey: null,
          s3_key_silver: null,
          supplierCode: null,
          supplier_code: null,
          supplierId: null,
          supplier_id: null,
          supplierName: null,
          supplier_name: null,
          supplierProductSku: null,
          supplier_product_sku: null,
          fiscalCode: null,
          fiscal_code: null,
          categoryId: null,
          category_id: null,
          productType: null,
          tipo: null,
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
          availableQuantity: 22,
          available_quantity: null,
          stock_quantity: 22,
          ncm: null,
          laborRateTableId: null,
          labor_rate_table_id: null,
          laborRateTableName: null,
          labor_rate_table_name: null,
          createdAt: null,
          created_at: null,
          price: null,
          updatedAt: "2026-03-24T12:00:00.000Z",
          updated_at: "2026-03-24T12:00:00.000Z"
        }
      ]);
      const { app, controlPlane } = await createTestApp({
        productGateway,
        env: {
          INTERNAL_WEBHOOK_SECRET: "sync-secret-test"
        }
      });

      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/internal/webhooks/supabase-sync",
          headers: {
            "x-webhook-secret": "sync-secret-test"
          },
          payload: {
            type: "UPDATE"
          }
        });

        assert.equal(response.statusCode, 200);
        const syncedProduct = await controlPlane.findMasterProductById("prod-sync-1");
        assert.ok(syncedProduct);
        assert.equal(syncedProduct.masterStock, 22);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Admin session config exposes active login mode",
    fn: async () => {
      const { app } = await createTestApp({
        env: {
          ADMIN_USERNAME: "superadmin",
          ADMIN_PASSWORD: "senha-segura-123",
          ADMIN_SESSION_SECRET: "sessao-super-segura"
        }
      });

      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/internal/admin/session/config"
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.json().data.requiresAuth, true);
        assert.equal(response.json().data.loginMode, "credentials");
        assert.equal(response.json().data.usernameHint, "superadmin");
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Internal admin endpoints manage companies, keys, and inventory",
    fn: async () => {
      const { app } = await createTestApp({
        env: {
          ADMIN_TOKEN: "secret-token"
        }
      });

      try {
        const companyResponse = await app.inject({
          method: "POST",
          url: "/admin/companies",
          headers: {
            "x-admin-token": "secret-token"
          },
          payload: {
            legalName: "Empresa Admin",
            externalCode: "empresa-admin"
          }
        });

        assert.equal(companyResponse.statusCode, 201);
        const companyId = companyResponse.json().data.id;

        const updateCompanyResponse = await app.inject({
          method: "PATCH",
          url: `/api/internal/admin/companies/${companyId}`,
          headers: {
            "x-admin-token": "secret-token"
          },
          payload: {
            legalName: "Empresa Admin Atualizada",
            isActive: true
          }
        });

        assert.equal(updateCompanyResponse.statusCode, 200);
        assert.equal(updateCompanyResponse.json().data.legalName, "Empresa Admin Atualizada");

        const apiKeyResponse = await app.inject({
          method: "POST",
          url: "/api/internal/admin/api-keys",
          headers: {
            "x-admin-token": "secret-token"
          },
          payload: {
            companyId,
            rateLimitPerMinute: 15
          }
        });

        assert.equal(apiKeyResponse.statusCode, 201);
        assert.match(apiKeyResponse.json().data.plaintextKey, /b2b_/);
        const apiKeyId = apiKeyResponse.json().data.apiKeyId;

        const listCompaniesResponse = await app.inject({
          method: "GET",
          url: "/api/internal/admin/companies",
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(listCompaniesResponse.statusCode, 200);
        assert.equal(listCompaniesResponse.json().data[0].apiKeyCount, 1);
        assert.equal(listCompaniesResponse.json().data[0].activeKeyCount, 1);

        const syncResponse = await app.inject({
          method: "POST",
          url: "/api/internal/webhooks/supabase-sync",
          headers: {
            "x-webhook-secret": "test-internal-sync-secret"
          },
          payload: {
            type: "UPDATE"
          }
        });

        assert.equal(syncResponse.statusCode, 200);

        const adminSyncResponse = await app.inject({
          method: "POST",
          url: "/api/internal/admin/products/sync",
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(adminSyncResponse.statusCode, 200);
        assert.equal(adminSyncResponse.json().data.syncedCount, 1);

        const adminProductsResponse = await app.inject({
          method: "GET",
          url: "/api/internal/admin/products",
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(adminProductsResponse.statusCode, 200);
        assert.equal(
          adminProductsResponse.json().data[0].main_image_url,
          "https://api.example.com/api/v1/media/object/joias%2Fraw%2FSKU-001%2FSKU-001_st.jpg"
        );
        assert.equal(adminProductsResponse.json().data[0].variants[0].stockWeightGrams, 4);
        assert.equal(adminProductsResponse.json().data[0].variants[0].stockUnits, 0);
        assert.equal(adminProductsResponse.json().data[0].variants[0].cost, 60.9);

        const inventoryResponse = await app.inject({
          method: "GET",
          url: `/api/internal/admin/companies/${companyId}/inventory`,
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(inventoryResponse.statusCode, 200);
        assert.equal(inventoryResponse.json().meta.companyId, companyId);
        assert.equal(inventoryResponse.json().data.length, 1);
        assert.equal(inventoryResponse.json().data[0].variants[0].stockWeightGrams, 4);
        assert.equal(inventoryResponse.json().data[0].variants[0].stockUnits, 0);
        assert.equal(inventoryResponse.json().data[0].variants[0].cost, 60.9);

        const updateInventoryResponse = await app.inject({
          method: "PUT",
          url: `/api/internal/admin/companies/${companyId}/inventory/prod-1`,
          headers: {
            "x-admin-token": "secret-token"
          },
          payload: {
            customStockQuantity: 8
          }
        });

        assert.equal(updateInventoryResponse.statusCode, 200);
        assert.equal(updateInventoryResponse.json().data.effectiveStockQuantity, 8);

        const deactivateResponse = await app.inject({
          method: "PATCH",
          url: `/api/internal/admin/companies/${companyId}/status`,
          headers: {
            "x-admin-token": "secret-token"
          },
          payload: {
            isActive: false
          }
        });

        assert.equal(deactivateResponse.statusCode, 200);
        assert.equal(deactivateResponse.json().data.isActive, false);

        const revokeResponse = await app.inject({
          method: "PATCH",
          url: `/api/internal/admin/api-keys/${apiKeyId}/revoke`,
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(revokeResponse.statusCode, 200);
        assert.equal(revokeResponse.json().data.isRevoked, true);

        const updatedCompaniesResponse = await app.inject({
          method: "GET",
          url: "/api/internal/admin/companies",
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(updatedCompaniesResponse.statusCode, 200);
        assert.equal(updatedCompaniesResponse.json().data[0].activeKeyCount, 0);

        const deleteCompanyResponse = await app.inject({
          method: "DELETE",
          url: `/api/internal/admin/companies/${companyId}`,
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(deleteCompanyResponse.statusCode, 200);
        assert.equal(deleteCompanyResponse.json().data.id, companyId);

        const companiesAfterDeleteResponse = await app.inject({
          method: "GET",
          url: "/api/internal/admin/companies",
          headers: {
            "x-admin-token": "secret-token"
          }
        });

        assert.equal(companiesAfterDeleteResponse.statusCode, 200);
        assert.equal(companiesAfterDeleteResponse.json().data.length, 0);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "Admin login creates session accepted by internal routes",
    fn: async () => {
      const { app } = await createTestApp({
        env: {
          ADMIN_USERNAME: "superadmin",
          ADMIN_PASSWORD: "senha-segura-123",
          ADMIN_SESSION_SECRET: "sessao-super-segura"
        }
      });

      try {
        const loginResponse = await app.inject({
          method: "POST",
          url: "/api/internal/admin/session/login",
          payload: {
            username: "superadmin",
            password: "senha-segura-123"
          }
        });

        assert.equal(loginResponse.statusCode, 200);
        const sessionToken = loginResponse.json().data.token;
        assert.ok(sessionToken);

        const meResponse = await app.inject({
          method: "GET",
          url: "/api/internal/admin/session/me",
          headers: {
            authorization: `Bearer ${sessionToken}`
          }
        });

        assert.equal(meResponse.statusCode, 200);
        assert.equal(meResponse.json().data.admin.username, "superadmin");

        const companiesResponse = await app.inject({
          method: "GET",
          url: "/api/internal/admin/companies",
          headers: {
            authorization: `Bearer ${sessionToken}`
          }
        });

        assert.equal(companiesResponse.statusCode, 200);
      } finally {
        await app.close();
      }
    }
  },
  {
    name: "OpenAPI contract documents public and internal admin routes",
    fn: async () => {
      const openApiDocument = YAML.parse(
        readFileSync(
          "C:\\Users\\goohf\\Desktop\\parceiros\\specs\\001-b2b-stock-gateway\\contracts\\openapi.yaml",
          "utf-8"
        )
      );

      assert.ok(openApiDocument.paths["/api/v1/products"]);
      assert.ok(openApiDocument.paths["/api/v1/products"].get);
      assert.ok(openApiDocument.paths["/api/v1/companyid"]);
      assert.ok(openApiDocument.paths["/api/v1/companyid"].get);
      assert.ok(openApiDocument.paths["/api/v1/media/object/{storageKey}"]);
      assert.ok(openApiDocument.paths["/api/v1/my-inventory"]);
      assert.ok(openApiDocument.paths["/api/v1/my-inventory"].get);
      assert.ok(openApiDocument.paths["/api/v1/my-inventory"].post);
      assert.ok(openApiDocument.paths["/api/v1/my-inventory/{productId}"]);
      assert.ok(openApiDocument.paths["/api/v1/my-inventory/{productId}"].patch);
      assert.ok(openApiDocument.paths["/api/internal/webhooks/supabase-sync"]);
      assert.ok(openApiDocument.paths["/api/internal/admin/companies"]);
      assert.ok(openApiDocument.paths["/api/internal/admin/companies/{companyId}"]);
      assert.ok(
        openApiDocument.paths["/api/internal/admin/companies/{companyId}/inventory"]
      );
      assert.ok(
        openApiDocument.paths[
          "/api/internal/admin/companies/{companyId}/inventory/{productId}"
        ]
      );
    }
  }
  ,
  {
    name: "Partner inventory update uses PATCH and snake_case payload",
    fn: async () => {
      const { app, controlPlane, env } = await createTestApp();
      try {
        const company = controlPlane.seedCompany({
          legalName: "Empresa Parceira",
          externalCode: "empresa-parceira"
        });
        const apiKey = "b2b_inventory_patch_key";

        controlPlane.seedApiKey({
          companyId: company.id,
          keyPrefix: deriveApiKeyPrefix(apiKey),
          keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
          rateLimitPerMinute: 20
        });

        await controlPlane.replaceMasterProducts([
          {
            id: "prod-patch-1",
            sku: "PATCH-001",
            name: "Produto Patch",
            masterStock: 12,
            updatedAt: new Date("2026-03-24T00:00:00.000Z")
          }
        ]);

        const patchResponse = await app.inject({
          method: "PATCH",
          url: "/api/v1/my-inventory/prod-patch-1",
          headers: {
            authorization: `Bearer ${apiKey}`
          },
          payload: {
            custom_stock_quantity: 7
          }
        });

        assert.equal(patchResponse.statusCode, 200);
        assert.equal(patchResponse.json().data.customStockQuantity, 7);

        const getResponse = await app.inject({
          method: "GET",
          url: "/api/v1/my-inventory",
          headers: {
            authorization: `Bearer ${apiKey}`
          }
        });

        assert.equal(getResponse.statusCode, 200);
        assert.equal(getResponse.json().data[0].customStockQuantity, 7);
      } finally {
        await app.close();
      }
    }
  }
];

async function main() {
  let failures = 0;

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.fn);
    if (!ok) {
      failures += 1;
    }
  }

  console.log(`\nExecuted ${cases.length} checks`);

  if (failures > 0) {
    console.error(`${failures} checks failed`);
    process.exitCode = 1;
    return;
  }

  console.log("All checks passed");
}

void main();
