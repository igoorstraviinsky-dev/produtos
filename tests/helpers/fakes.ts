import { randomUUID } from "node:crypto";

import { buildApp } from "../../src/app";
import { AppEnv } from "../../src/config/env";
import {
  ApiKeyRecord,
  CompanyRecord,
  ControlPlaneRepository,
  CreateApiKeyInput,
  CreateCompanyInput
} from "../../src/lib/postgres";
import { ProductCacheStore, RateLimitCounterStore } from "../../src/lib/redis";
import { ProductGateway, ProductRecord } from "../../src/lib/supabase";

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
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_PRODUCTS_TABLE: "products",
    API_KEY_PEPPER: "test-pepper-value",
    PRODUCTS_CACHE_TTL_SECONDS: 60,
    PRODUCTS_CACHE_STALE_SECONDS: 300,
    ADMIN_TOKEN: undefined,
    ...overrides
  };
}

export class FakeControlPlaneRepository implements ControlPlaneRepository {
  private readonly companies = new Map<string, CompanyRecord>();
  private readonly apiKeys = new Map<string, ApiKeyRecord>();

  seedCompany(input: SeedCompanyInput) {
    const now = new Date();
    const company: CompanyRecord = {
      id: input.id ?? randomUUID(),
      legalName: input.legalName,
      externalCode: input.externalCode,
      isActive: input.isActive ?? true,
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
}

export async function createTestApp(options?: {
  env?: Partial<AppEnv>;
  controlPlane?: FakeControlPlaneRepository;
  productCache?: FakeProductCacheStore;
  rateLimitCounter?: FakeRateLimitCounterStore;
  productGateway?: FakeProductGateway;
}) {
  const env = createTestEnv(options?.env);
  const controlPlane = options?.controlPlane ?? new FakeControlPlaneRepository();
  const productCache = options?.productCache ?? new FakeProductCacheStore();
  const rateLimitCounter = options?.rateLimitCounter ?? new FakeRateLimitCounterStore();
  const productGateway =
    options?.productGateway ??
    new FakeProductGateway([
      {
        id: "prod-1",
        sku: "SKU-001",
        name: "Produto 1",
        availableQuantity: 10,
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
