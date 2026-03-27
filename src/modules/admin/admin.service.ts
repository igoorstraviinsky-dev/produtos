import {
  ControlPlaneRepository,
  CreateCompanyInput,
  UpdateCostSettingsInput,
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
  variantStockQuantityTotal: number | null;
  hasVariantInventory: boolean;
  effectiveStockQuantity: number;
  updatedAt: Date;
  variants: Array<{
    variantId: string;
    productId: string;
    sku: string;
    individualWeight: number | null;
    masterStock: number;
    customStockQuantity: number | null;
    effectiveStockQuantity: number;
    updatedAt: Date;
  }>;
}) {
  return {
    productId: record.productId,
    sku: record.sku,
    name: record.name,
    masterStock: record.masterStock,
    customStockQuantity: record.customStockQuantity,
    variantStockQuantityTotal: record.variantStockQuantityTotal,
    hasVariantInventory: record.hasVariantInventory,
    effectiveStockQuantity: record.effectiveStockQuantity,
    updatedAt: record.updatedAt.toISOString(),
    variants: record.variants.map((variant) => ({
      variantId: variant.variantId,
      productId: variant.productId,
      sku: variant.sku,
      individualWeight: variant.individualWeight,
      masterStock: variant.masterStock,
      customStockQuantity: variant.customStockQuantity,
      effectiveStockQuantity: variant.effectiveStockQuantity,
      updatedAt: variant.updatedAt.toISOString()
    }))
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

  async deleteCompany(companyId: string) {
    const company = await this.controlPlane.deleteCompany(companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Company was not found");
    }

    return {
      data: {
        id: company.id,
        legalName: company.legalName,
        externalCode: company.externalCode,
        isActive: company.isActive,
        syncStoreInventory: company.syncStoreInventory,
        apiKeyCount: company.apiKeyCount,
        activeKeyCount: company.activeKeyCount,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      }
    };
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

  async getCostSettings() {
    const settings = await this.controlPlane.getCostSettings();

    return {
      data: {
        silverPricePerGram: settings.silverPricePerGram,
        zonaFrancaRatePercent: settings.zonaFrancaRatePercent,
        transportFee: settings.transportFee,
        dollarRate: settings.dollarRate,
        updatedAt: settings.updatedAt.toISOString()
      }
    };
  }

  async updateCostSettings(input: UpdateCostSettingsInput) {
    const settings = await this.controlPlane.updateCostSettings(input);

    return {
      data: {
        silverPricePerGram: settings.silverPricePerGram,
        zonaFrancaRatePercent: settings.zonaFrancaRatePercent,
        transportFee: settings.transportFee,
        dollarRate: settings.dollarRate,
        updatedAt: settings.updatedAt.toISOString()
      }
    };
  }

  async listCostSettingsHistory() {
    const history = await this.controlPlane.listCostSettingsHistory();

    return {
      data: history.map((entry) => ({
        id: entry.id,
        changedFields: entry.changedFields,
        previous: {
          silverPricePerGram: entry.previousSilverPricePerGram,
          zonaFrancaRatePercent: entry.previousZonaFrancaRatePercent,
          transportFee: entry.previousTransportFee,
          dollarRate: entry.previousDollarRate
        },
        next: {
          silverPricePerGram: entry.nextSilverPricePerGram,
          zonaFrancaRatePercent: entry.nextZonaFrancaRatePercent,
          transportFee: entry.nextTransportFee,
          dollarRate: entry.nextDollarRate
        },
        createdAt: entry.createdAt.toISOString()
      }))
    };
  }
}
