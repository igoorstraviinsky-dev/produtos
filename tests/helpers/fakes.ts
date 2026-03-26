import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { buildApp } from "../../src/app";
import { AppEnv } from "../../src/config/env";
import {
  ApiKeyRecord,
  CompanyRecord,
  CostSettingsRecord,
  ControlPlaneRepository,
  CreateApiKeyInput,
  CreateCompanyInput
} from "../../src/lib/postgres";
import { ProductCacheStore, RateLimitCounterStore } from "../../src/lib/redis";
import { ProductGateway, ProductRecord } from "../../src/lib/supabase";
import { ProductMediaService } from "../../src/modules/media/media.service";

type SeedCompanyInput = {
  id?: string;
  legalName: string;
  externalCode: string;
  isActive?: boolean;
};

type SeedApiKeyInput = {
  id?: string;
  companyId: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitPerMinute: number;
  isRevoked?: boolean;
};

export function createTestEnv(overrides: Partial<AppEnv> = {}): AppEnv {
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

export class FakeControlPlaneRepository implements ControlPlaneRepository {
  private readonly companies = new Map<string, CompanyRecord>();
  private readonly apiKeys = new Map<string, ApiKeyRecord>();
  private readonly costSettingsHistory: Array<{
    id: string;
    previousSilverPricePerGram: number;
    nextSilverPricePerGram: number;
    previousZonaFrancaRatePercent: number;
    nextZonaFrancaRatePercent: number;
    previousTransportFee: number;
    nextTransportFee: number;
    previousDollarRate: number;
    nextDollarRate: number;
    changedFields: string[];
    createdAt: Date;
  }> = [];
  private costSettings: CostSettingsRecord = {
    silverPricePerGram: 1,
    zonaFrancaRatePercent: 6,
    transportFee: 0.1,
    dollarRate: 5,
    updatedAt: new Date()
  };

  seedCompany(input: SeedCompanyInput) {
    const now = new Date();
    const company: CompanyRecord = {
      id: input.id ?? randomUUID(),
      legalName: input.legalName,
      externalCode: input.externalCode,
      isActive: input.isActive ?? true,
      apiKeyCount: 0,
      activeKeyCount: 0,
      createdAt: now,
      updatedAt: now
    };

    this.companies.set(company.id, company);
    return company;
  }

  seedApiKey(input: SeedApiKeyInput) {
    const company = this.companies.get(input.companyId);
    if (!company) {
      throw new Error("Company seed missing");
    }

    const apiKey: ApiKeyRecord = {
      id: input.id ?? randomUUID(),
      companyId: company.id,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      rateLimitPerMinute: input.rateLimitPerMinute,
      isRevoked: input.isRevoked ?? false,
      revokedAt: input.isRevoked ? new Date() : null,
      lastUsedAt: null,
      createdAt: new Date(),
      company
    };

    this.apiKeys.set(apiKey.id, apiKey);
    return apiKey;
  }

  async createCompany(input: CreateCompanyInput) {
    return this.seedCompany(input);
  }

  async listCompanies() {
    return [...this.companies.values()];
  }

  async updateCompanyStatus(companyId: string, isActive: boolean) {
    const company = this.companies.get(companyId);
    if (!company) {
      return null;
    }

    const updated: CompanyRecord = {
      ...company,
      isActive,
      updatedAt: new Date()
    };
    this.companies.set(companyId, updated);

    for (const [apiKeyId, apiKey] of this.apiKeys.entries()) {
      if (apiKey.companyId === companyId) {
        this.apiKeys.set(apiKeyId, {
          ...apiKey,
          company: updated
        });
      }
    }

    return updated;
  }

  async findCompanyById(companyId: string) {
    return this.companies.get(companyId) ?? null;
  }

  async createApiKey(input: CreateApiKeyInput) {
    return this.seedApiKey(input);
  }

  async revokeApiKey(apiKeyId: string) {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) {
      return null;
    }

    const updated: ApiKeyRecord = {
      ...apiKey,
      isRevoked: true,
      revokedAt: new Date()
    };
    this.apiKeys.set(apiKeyId, updated);
    return updated;
  }

  async findApiKeyByHash(keyHash: string) {
    return [...this.apiKeys.values()].find((apiKey) => apiKey.keyHash === keyHash) ?? null;
  }

  async touchApiKeyUsage(apiKeyId: string, usedAt: Date) {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) {
      return;
    }

    this.apiKeys.set(apiKeyId, {
      ...apiKey,
      lastUsedAt: usedAt
    });
  }

  async updateCompany(companyId: string, input: { legalName?: string; isActive?: boolean }) {
    const company = this.companies.get(companyId);
    if (!company) {
      return null;
    }

    const updated: CompanyRecord = {
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
          company: updated
        });
      }
    }

    return updated;
  }

  async listApiKeysByCompany(companyId: string) {
    return [...this.apiKeys.values()].filter((apiKey) => apiKey.companyId === companyId);
  }

  async listMasterProducts() {
    return [];
  }

  async replaceMasterProducts() {
    return [];
  }

  async findMasterProductById() {
    return null;
  }

  async listEffectiveInventoryByCompany() {
    return [];
  }

  async upsertCompanyInventory() {
    return null;
  }

  async getCostSettings() {
    return this.costSettings;
  }

  async updateCostSettings(input: {
    silverPricePerGram?: number;
    zonaFrancaRatePercent?: number;
    transportFee?: number;
    dollarRate?: number;
  }) {
    const nextSettings = {
      silverPricePerGram: input.silverPricePerGram ?? this.costSettings.silverPricePerGram,
      zonaFrancaRatePercent:
        input.zonaFrancaRatePercent ?? this.costSettings.zonaFrancaRatePercent,
      transportFee: input.transportFee ?? this.costSettings.transportFee,
      dollarRate: input.dollarRate ?? this.costSettings.dollarRate
    };
    const changedFields = [
      ...(nextSettings.silverPricePerGram !== this.costSettings.silverPricePerGram
        ? ["silverPricePerGram"]
        : []),
      ...(nextSettings.zonaFrancaRatePercent !== this.costSettings.zonaFrancaRatePercent
        ? ["zonaFrancaRatePercent"]
        : []),
      ...(nextSettings.transportFee !== this.costSettings.transportFee ? ["transportFee"] : []),
      ...(nextSettings.dollarRate !== this.costSettings.dollarRate ? ["dollarRate"] : [])
    ];

    if (changedFields.length === 0) {
      return this.costSettings;
    }

    this.costSettingsHistory.unshift({
      id: randomUUID(),
      previousSilverPricePerGram: this.costSettings.silverPricePerGram,
      nextSilverPricePerGram: nextSettings.silverPricePerGram,
      previousZonaFrancaRatePercent: this.costSettings.zonaFrancaRatePercent,
      nextZonaFrancaRatePercent: nextSettings.zonaFrancaRatePercent,
      previousTransportFee: this.costSettings.transportFee,
      nextTransportFee: nextSettings.transportFee,
      previousDollarRate: this.costSettings.dollarRate,
      nextDollarRate: nextSettings.dollarRate,
      changedFields,
      createdAt: new Date()
    });

    this.costSettings = {
      silverPricePerGram: nextSettings.silverPricePerGram,
      zonaFrancaRatePercent: nextSettings.zonaFrancaRatePercent,
      transportFee: nextSettings.transportFee,
      dollarRate: nextSettings.dollarRate,
      updatedAt: new Date()
    };

    return this.costSettings;
  }

  async listCostSettingsHistory() {
    return this.costSettingsHistory;
  }
}

export class FakeProductCacheStore implements ProductCacheStore {
  private readonly entries = new Map<string, string>();

  async get<T>(key: string) {
    const value = this.entries.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T) {
    this.entries.set(key, JSON.stringify(value));
  }

  async delete(key: string) {
    this.entries.delete(key);
  }
}

export class FakeRateLimitCounterStore implements RateLimitCounterStore {
  private readonly counters = new Map<string, number>();

  async increment(key: string) {
    const nextValue = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, nextValue);
    return nextValue;
  }
}

export class FakeProductGateway implements ProductGateway {
  public products: ProductRecord[];
  public error: Error | null = null;

  constructor(products: ProductRecord[]) {
    this.products = products;
  }

  async listProducts() {
    if (this.error) {
      throw this.error;
    }
    return this.products;
  }

  async updateProduct(input: {
    id: string;
    sku: string;
    name: string;
    availableQuantity: number;
  }) {
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

export class FakeProductMediaService implements ProductMediaService {
  async getObjectByStorageKey(storageKey: string) {
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

export async function createTestApp(options?: {
  env?: Partial<AppEnv>;
  controlPlane?: FakeControlPlaneRepository;
  productCache?: FakeProductCacheStore;
  rateLimitCounter?: FakeRateLimitCounterStore;
  productGateway?: FakeProductGateway;
  productMediaService?: FakeProductMediaService;
}) {
  const env = createTestEnv(options?.env);
  const controlPlane = options?.controlPlane ?? new FakeControlPlaneRepository();
  const productCache = options?.productCache ?? new FakeProductCacheStore();
  const rateLimitCounter = options?.rateLimitCounter ?? new FakeRateLimitCounterStore();
  const productMediaService = options?.productMediaService ?? new FakeProductMediaService();
  const productGateway =
    options?.productGateway ??
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
        weight_grams: "10.5",
        weightGrams: "10.5",
        peso_gramas: "10.5",
        bathType: null,
        tipo_banho: null,
        status: "AVAILABLE",
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
        availableQuantity: 10,
        available_quantity: null,
        stock_quantity: 10,
        ncm: null,
        laborRateTableId: null,
        labor_rate_table_id: null,
        laborRateTableName: null,
        labor_rate_table_name: null,
        createdAt: "2026-03-23T00:00:00.000Z",
        created_at: "2026-03-23T00:00:00.000Z",
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
