import {
  ControlPlaneRepository,
  CreateCompanyInput,
  UpdateCompanyInput
} from "../../lib/postgres";
import { AppError } from "../../middleware/error-handler";
import { deriveApiKeyPrefix, generateApiKey, hashApiKey } from "../../utils/crypto";

function mapInventoryItem(record: {
  productId: string;
  sku: string;
  name: string;
  masterStock: number;
  customStockQuantity: number | null;
  effectiveStockQuantity: number;
  updatedAt: Date;
}) {
  return {
    productId: record.productId,
    sku: record.sku,
    name: record.name,
    masterStock: record.masterStock,
    customStockQuantity: record.customStockQuantity,
    effectiveStockQuantity: record.effectiveStockQuantity,
    updatedAt: record.updatedAt.toISOString()
  };
}

export class AdminService {
  constructor(
    private readonly controlPlane: ControlPlaneRepository,
    private readonly pepper: string
  ) {}

  async createCompany(input: CreateCompanyInput) {
    return this.controlPlane.createCompany(input);
  }

  async listCompanies() {
    return this.controlPlane.listCompanies();
  }

  async updateCompany(companyId: string, input: UpdateCompanyInput) {
    const company = await this.controlPlane.updateCompany(companyId, input);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
    }

    return company;
  }

  async listCompanyApiKeys(companyId: string) {
    const company = await this.controlPlane.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
    }

    const apiKeys = await this.controlPlane.listApiKeysByCompany(companyId);
    return apiKeys.map((apiKey) => ({
      id: apiKey.id,
      companyId: apiKey.companyId,
      keyPrefix: apiKey.keyPrefix,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      isRevoked: apiKey.isRevoked,
      revokedAt: apiKey.revokedAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt
    }));
  }

  async updateCompanyStatus(companyId: string, isActive: boolean) {
    return this.updateCompany(companyId, {
      isActive
    });
  }

  async issueApiKey(companyId: string, rateLimitPerMinute: number) {
    const company = await this.controlPlane.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
    }

    const plaintextKey = generateApiKey();
    const apiKey = await this.controlPlane.createApiKey({
      companyId,
      keyPrefix: deriveApiKeyPrefix(plaintextKey),
      keyHash: hashApiKey(plaintextKey, this.pepper),
      rateLimitPerMinute
    });

    return {
      apiKeyId: apiKey.id,
      companyId: apiKey.companyId,
      keyPrefix: apiKey.keyPrefix,
      plaintextKey,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      isRevoked: apiKey.isRevoked
    };
  }

  async revokeApiKey(apiKeyId: string) {
    const apiKey = await this.controlPlane.revokeApiKey(apiKeyId);
    if (!apiKey) {
      throw new AppError(404, "API_KEY_NOT_FOUND", "API key was not found");
    }

    return {
      id: apiKey.id,
      companyId: apiKey.companyId,
      keyPrefix: apiKey.keyPrefix,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      isRevoked: apiKey.isRevoked,
      revokedAt: apiKey.revokedAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt
    };
  }

  async listCompanyInventory(companyId: string) {
    const company = await this.controlPlane.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
    }

    const inventory = await this.controlPlane.listEffectiveInventoryByCompany(companyId);

    return {
      data: inventory.map(mapInventoryItem),
      meta: {
        companyId,
        companyName: company.legalName,
        count: inventory.length
      }
    };
  }

  async updateCompanyInventory(
    companyId: string,
    productId: string,
    customStockQuantity: number
  ) {
    const company = await this.controlPlane.findCompanyById(companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
    }

    const updatedInventory = await this.controlPlane.upsertCompanyInventory(
      companyId,
      productId,
      customStockQuantity
    );

    if (!updatedInventory) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product was not found in the master catalog");
    }

    return {
      data: mapInventoryItem(updatedInventory),
      meta: {
        companyId,
        companyName: company.legalName
      }
    };
  }
}
