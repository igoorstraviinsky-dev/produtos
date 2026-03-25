const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");

const YAML = require("yaml");

const { buildApp } = require("../dist/app.js");
const { ApiKeyService } = require("../dist/modules/auth/api-key.service.js");
const { ProductsService } = require("../dist/modules/products/products.service.js");
const { buildProductsCacheKey } = require("../dist/utils/cache-keys.js");
const { deriveApiKeyPrefix, hashApiKey } = require("../dist/utils/crypto.js");

function createTestEnv(overrides = {}) {
  return {
    PORT: 3000,
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
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
    this.costSettings = {
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

  async getCostSettings() {
    return this.costSettings;
  }

  async updateCostSettings(input) {
    this.costSettings = {
      silverPricePerGram: input.silverPricePerGram ?? this.costSettings.silverPricePerGram,
      zonaFrancaRatePercent:
        input.zonaFrancaRatePercent ?? this.costSettings.zonaFrancaRatePercent,
      transportFee: input.transportFee ?? this.costSettings.transportFee,
      dollarRate: input.dollarRate ?? this.costSettings.dollarRate,
      updatedAt: new Date()
    };

    return this.costSettings;
  }

  async listEffectiveInventoryByCompany(companyId) {
    return [...this.masterProducts.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((product) => {
        const companyInventory = this.companyInventory.get(`${companyId}:${product.id}`) ?? null;
        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          masterStock: product.masterStock,
          customStockQuantity: companyInventory?.customStockQuantity ?? null,
          effectiveStockQuantity:
            companyInventory?.customStockQuantity ?? product.masterStock,
          updatedAt: companyInventory?.updatedAt ?? product.updatedAt
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
      effectiveStockQuantity: record.customStockQuantity,
      updatedAt: record.updatedAt
    };
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
  constructor(products) {
    this.products = products;
    this.error = null;
  }

  async listProducts() {
    if (this.error) {
      throw this.error;
    }

    return this.products;
  }

  async updateProduct(input) {
    const product = this.products.find((item) => item.id === input.id);
    if (!product) {
      throw new Error("Product not found");
    }

    const updated = {
      ...product,
      sku: input.sku,
      name: input.name,
      serialNumber: input.sku,
      availableQuantity: input.availableQuantity
    };

    this.products = this.products.map((item) => (item.id === input.id ? updated : item));
    return updated;
  }
}

async function createTestApp(options = {}) {
  const env = createTestEnv(options.env);
  const controlPlane = options.controlPlane ?? new FakeControlPlaneRepository();
  const productCache = options.productCache ?? new FakeProductCacheStore();
  const rateLimitCounter = options.rateLimitCounter ?? new FakeRateLimitCounterStore();
  const productGateway =
    options.productGateway ??
    new FakeProductGateway([
      {
        id: "prod-1",
        sku: "SKU-001",
        name: "Produto 1",
        serialNumber: "SKU-001",
        description: null,
        category: null,
        subcategory: null,
        baseMaterial: null,
        purity: null,
        weightGrams: "10.5",
        bathType: null,
        status: null,
        bronzeImageKey: null,
        silverImageKey: null,
        supplierCode: null,
        fiscalCode: null,
        categoryId: null,
        productType: null,
        typeId: null,
        subcategoryId: null,
        blingProductId: null,
        blingLastSyncAt: null,
        laborRateId: null,
        laborRateLabel: null,
        laborCost: null,
        sizeOptionId: null,
        sizeLabel: null,
        colorOptionId: null,
        colorLabel: null,
        availableQuantity: 10,
        ncm: null,
        laborRateTableId: null,
        laborRateTableName: null,
        createdAt: null,
        price: 99.9,
        updatedAt: "2026-03-23T00:00:00.000Z"
      }
    ]);

  const app = await buildApp({
    env,
    controlPlane,
    productCache,
    rateLimitCounter,
    productGateway
  });

  return {
    app,
    env,
    controlPlane,
    productCache,
    rateLimitCounter,
    productGateway
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
          id: "prod-1",
          sku: "SKU-001",
          name: "Produto 1",
          serialNumber: "SKU-001",
          description: null,
          category: null,
          subcategory: null,
          baseMaterial: null,
          purity: null,
          weightGrams: "5.5",
          bathType: null,
          status: null,
          bronzeImageKey: null,
          silverImageKey: null,
          supplierCode: null,
          fiscalCode: null,
          categoryId: null,
          productType: null,
          typeId: null,
          subcategoryId: null,
          blingProductId: null,
          blingLastSyncAt: null,
          laborRateId: null,
          laborRateLabel: null,
          laborCost: null,
          sizeOptionId: null,
          sizeLabel: null,
          colorOptionId: null,
          colorLabel: null,
          availableQuantity: 5,
          ncm: null,
          laborRateTableId: null,
          laborRateTableName: null,
          createdAt: null,
          price: 10,
          updatedAt: "2026-03-23T00:00:00.000Z"
        }
      ]);

      const service = new ProductsService({ env, cacheStore, productGateway, controlPlane });
      const firstResponse = await service.listProducts();
      const secondResponse = await service.listProducts();

      assert.equal(firstResponse.meta.source, "upstream");
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
            id: "prod-1",
            sku: "SKU-001",
            name: "Produto 1",
            serialNumber: "SKU-001",
            description: null,
            category: null,
            subcategory: null,
            baseMaterial: null,
            purity: null,
            weightGrams: "5.5",
            bathType: null,
            status: null,
            bronzeImageKey: null,
            silverImageKey: null,
            supplierCode: null,
            fiscalCode: null,
            categoryId: null,
            productType: null,
            typeId: null,
            subcategoryId: null,
            blingProductId: null,
            blingLastSyncAt: null,
            laborRateId: null,
            laborRateLabel: null,
            laborCost: null,
            sizeOptionId: null,
            sizeLabel: null,
            colorOptionId: null,
            colorLabel: null,
            availableQuantity: 5,
            ncm: null,
            laborRateTableId: null,
            laborRateTableName: null,
            createdAt: null,
            price: 10,
            updatedAt: "2026-03-23T00:00:00.000Z"
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
    name: "Sync webhook refreshes local master catalog",
    fn: async () => {
      const productGateway = new FakeProductGateway([
        {
          id: "prod-sync-1",
          sku: "SYNC-001",
          name: "Produto Sincronizado",
          availableQuantity: 22,
          price: null,
          updatedAt: "2026-03-24T12:00:00.000Z"
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
      assert.ok(openApiDocument.paths["/api/v1/my-inventory"]);
      assert.ok(openApiDocument.paths["/api/v1/my-inventory"].get);
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
