import crypto from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

export type CompanyRecord = {
  id: string;
  legalName: string;
  externalCode: string;
  isActive: boolean;
  syncStoreInventory: boolean;
  apiKeyCount: number;
  activeKeyCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiKeyRecord = {
  id: string;
  companyId: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitPerMinute: number;
  isRevoked: boolean;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  company: CompanyRecord;
};

export type MasterProductRecord = {
  id: string;
  sku: string;
  name: string;
  masterStock: number;
  updatedAt: Date;
};

export type ProductVariantRecord = {
  id: string;
  productId: string;
  sku: string;
  individualWeight: number | null;
  individualStock: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CostSettingsRecord = {
  companyId: string | null;
  silverPricePerGram: number;
  zonaFrancaRatePercent: number;
  transportFee: number;
  dollarRate: number;
  updatedAt: Date;
};

export type CostSettingsHistoryRecord = {
  id: string;
  companyId: string | null;
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
};

export type UpdateCostSettingsInput = {
  silverPricePerGram?: number;
  zonaFrancaRatePercent?: number;
  transportFee?: number;
  dollarRate?: number;
};

export type EffectiveInventoryRecord = {
  productId: string;
  sku: string;
  name: string;
  masterStock: number;
  customStockQuantity: number | null;
  variantStockQuantityTotal: number | null;
  hasVariantInventory: boolean;
  effectiveStockQuantity: number;
  updatedAt: Date;
  variants: EffectiveInventoryVariantRecord[];
};

export type EffectiveInventoryVariantRecord = {
  variantId: string;
  productId: string;
  sku: string;
  individualWeight: number | null;
  masterStock: number;
  customStockQuantity: number | null;
  effectiveStockQuantity: number;
  updatedAt: Date;
};

export type CreateCompanyInput = {
  legalName: string;
  externalCode: string;
};

export type UpdateCompanyInput = {
  legalName?: string;
  isActive?: boolean;
  syncStoreInventory?: boolean;
};

export type CreateApiKeyInput = {
  companyId: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitPerMinute: number;
};

export type UpsertMasterProductInput = {
  id: string;
  sku: string;
  name: string;
  masterStock: number;
  updatedAt: Date;
  variants?: UpsertProductVariantInput[];
};

export type UpsertProductVariantInput = {
  id: string;
  productId: string;
  sku: string;
  individualWeight?: number | null;
  individualStock: number;
  createdAt?: Date;
  updatedAt: Date;
};

type CompanyWithCounts = {
  id: string;
  legalName: string;
  externalCode: string;
  isActive: boolean;
  syncStoreInventory: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    apiKeys: number;
  };
  apiKeys?: Array<{
    isRevoked: boolean;
  }>;
};

export interface ControlPlaneRepository {
  createCompany(input: CreateCompanyInput): Promise<CompanyRecord>;
  listCompanies(): Promise<CompanyRecord[]>;
  updateCompany(companyId: string, input: UpdateCompanyInput): Promise<CompanyRecord | null>;
  updateCompanyStatus(companyId: string, isActive: boolean): Promise<CompanyRecord | null>;
  deleteCompany(companyId: string): Promise<CompanyRecord | null>;
  findCompanyById(companyId: string): Promise<CompanyRecord | null>;
  listApiKeysByCompany(companyId: string): Promise<ApiKeyRecord[]>;
  createApiKey(input: CreateApiKeyInput): Promise<ApiKeyRecord>;
  revokeApiKey(apiKeyId: string): Promise<ApiKeyRecord | null>;
  findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  touchApiKeyUsage(apiKeyId: string, usedAt: Date): Promise<void>;
  replaceMasterProducts(products: UpsertMasterProductInput[]): Promise<MasterProductRecord[]>;
  listMasterProducts(): Promise<MasterProductRecord[]>;
  findMasterProductById(productId: string): Promise<MasterProductRecord | null>;
  findMasterProductBySku(sku: string): Promise<MasterProductRecord | null>;
  listProductVariantsByProductId(productId: string): Promise<ProductVariantRecord[]>;
  getCostSettings(companyId?: string): Promise<CostSettingsRecord>;
  updateCostSettings(input: UpdateCostSettingsInput, companyId?: string): Promise<CostSettingsRecord>;
  listCostSettingsHistory(limit?: number, companyId?: string): Promise<CostSettingsHistoryRecord[]>;
  listEffectiveInventoryByCompany(companyId: string): Promise<EffectiveInventoryRecord[]>;
  upsertCompanyInventory(
    companyId: string,
    productId: string,
    customStockQuantity: number
  ): Promise<EffectiveInventoryRecord | null>;
  deleteCompanyInventory(companyId: string, productId: string): Promise<void>;
  upsertCompanyVariantInventory(
    companyId: string,
    variantId: string,
    customStockQuantity: number
  ): Promise<void>;
}

function mapCompany(company: CompanyWithCounts): CompanyRecord {
  return {
    id: company.id,
    legalName: company.legalName,
    externalCode: company.externalCode,
    isActive: company.isActive,
    syncStoreInventory: company.syncStoreInventory,
    apiKeyCount: company._count?.apiKeys ?? company.apiKeys?.length ?? 0,
    activeKeyCount:
      company.apiKeys?.filter((apiKey) => !apiKey.isRevoked).length ??
      (company._count?.apiKeys ?? 0),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt
  };
}

function mapApiKey(apiKey: {
  id: string;
  companyId: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitPerMinute: number;
  isRevoked: boolean;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  company: CompanyWithCounts;
}): ApiKeyRecord {
  return {
    id: apiKey.id,
    companyId: apiKey.companyId,
    keyPrefix: apiKey.keyPrefix,
    keyHash: apiKey.keyHash,
    rateLimitPerMinute: apiKey.rateLimitPerMinute,
    isRevoked: apiKey.isRevoked,
    revokedAt: apiKey.revokedAt,
    lastUsedAt: apiKey.lastUsedAt,
    createdAt: apiKey.createdAt,
    company: mapCompany(apiKey.company)
  };
}

function mapMasterProduct(product: {
  id: string;
  sku: string;
  name: string;
  masterStock: number;
  updatedAt: Date;
}): MasterProductRecord {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    masterStock: product.masterStock,
    updatedAt: product.updatedAt
  };
}

function mapProductVariant(variant: {
  id: string;
  productId: string;
  sku: string;
  individualWeight: number | null;
  individualStock: number;
  createdAt: Date;
  updatedAt: Date;
}): ProductVariantRecord {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    individualWeight: variant.individualWeight,
    individualStock: variant.individualStock,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt
  };
}

function mapCostSettings(settings: {
  companyId?: string | null;
  silverPricePerGram: number;
  zonaFrancaRatePercent: number;
  transportFee: number;
  dollarRate: number;
  updatedAt: Date;
}): CostSettingsRecord {
  return {
    companyId: settings.companyId ?? null,
    silverPricePerGram: settings.silverPricePerGram,
    zonaFrancaRatePercent: settings.zonaFrancaRatePercent,
    transportFee: settings.transportFee,
    dollarRate: settings.dollarRate,
    updatedAt: settings.updatedAt
  };
}

function parseChangedFields(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  const rawValue = value.trim();
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );
    }
  } catch {
    // Keep going and try legacy formats below.
  }

  if (rawValue.startsWith("{") && rawValue.endsWith("}")) {
    return rawValue
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"(.*)"$/, "$1"))
      .filter(Boolean);
  }

  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapCostSettingsHistory(history: {
  id: string;
  companyId?: string | null;
  previousSilverPricePerGram: number;
  nextSilverPricePerGram: number;
  previousZonaFrancaRatePercent: number;
  nextZonaFrancaRatePercent: number;
  previousTransportFee: number;
  nextTransportFee: number;
  previousDollarRate: number;
  nextDollarRate: number;
  changedFields: string;
  createdAt: Date;
}): CostSettingsHistoryRecord {
  return {
    id: history.id,
    companyId: history.companyId ?? null,
    previousSilverPricePerGram: history.previousSilverPricePerGram,
    nextSilverPricePerGram: history.nextSilverPricePerGram,
    previousZonaFrancaRatePercent: history.previousZonaFrancaRatePercent,
    nextZonaFrancaRatePercent: history.nextZonaFrancaRatePercent,
    previousTransportFee: history.previousTransportFee,
    nextTransportFee: history.nextTransportFee,
    previousDollarRate: history.previousDollarRate,
    nextDollarRate: history.nextDollarRate,
    changedFields: parseChangedFields(history.changedFields),
    createdAt: history.createdAt
  };
}

function mapEffectiveInventory(product: {
  id: string;
  sku: string;
  name: string;
  masterStock: number;
  updatedAt: Date;
  companyInventories: Array<{
    customStockQuantity: number;
    updatedAt: Date;
  }>;
  variants: Array<{
    id: string;
    productId: string;
    sku: string;
    individualWeight: number | null;
    individualStock: number;
    updatedAt: Date;
    companyVariantInventories: Array<{
      customStockQuantity: number;
      updatedAt: Date;
    }>;
  }>;
}): EffectiveInventoryRecord {
  const companyInventory = product.companyInventories[0] ?? null;
  const mappedVariants = product.variants.map((variant) => {
    const companyVariantInventory = variant.companyVariantInventories[0] ?? null;

    return {
      variantId: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      individualWeight: variant.individualWeight,
      masterStock: variant.individualStock,
      customStockQuantity: companyVariantInventory?.customStockQuantity ?? null,
      effectiveStockQuantity:
        companyVariantInventory?.customStockQuantity ?? variant.individualStock,
      updatedAt: companyVariantInventory?.updatedAt ?? variant.updatedAt
    };
  });
  const hasVariants = mappedVariants.length > 0;
  const hasCustomVariantInventory = mappedVariants.some(
    (variant) => variant.customStockQuantity !== null
  );
  const variantEffectiveStock = mappedVariants.reduce(
    (sum, variant) => sum + variant.effectiveStockQuantity,
    0
  );
  const variantMasterStock = mappedVariants.reduce((sum, variant) => sum + variant.masterStock, 0);
  const fallbackMasterStock = hasVariants ? variantMasterStock : product.masterStock;
  const latestVariantUpdate = mappedVariants.reduce<Date | null>((latest, variant) => {
    if (!latest || variant.updatedAt > latest) {
      return variant.updatedAt;
    }

    return latest;
  }, null);

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    masterStock: fallbackMasterStock,
    customStockQuantity: companyInventory?.customStockQuantity ?? null,
    variantStockQuantityTotal: hasCustomVariantInventory ? variantEffectiveStock : null,
    hasVariantInventory: hasCustomVariantInventory,
    effectiveStockQuantity: hasCustomVariantInventory
      ? variantEffectiveStock
      : companyInventory?.customStockQuantity ?? fallbackMasterStock,
    updatedAt: hasCustomVariantInventory
      ? latestVariantUpdate ?? companyInventory?.updatedAt ?? product.updatedAt
      : companyInventory?.updatedAt ?? product.updatedAt,
    variants: mappedVariants
  };
}

export function createPrismaClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
}

export class PrismaControlPlaneRepository implements ControlPlaneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCompany(input: CreateCompanyInput) {
    const company = await this.prisma.company.create({
      data: input
    });

    return mapCompany(company);
  }

  async listCompanies() {
    const companies = await this.prisma.company.findMany({
      orderBy: [{ isActive: "desc" }, { legalName: "asc" }],
      include: {
        _count: {
          select: {
            apiKeys: true
          }
        },
        apiKeys: {
          select: {
            isRevoked: true
          }
        }
      }
    });

    return companies.map(mapCompany);
  }

  async updateCompany(companyId: string, input: UpdateCompanyInput) {
    const company = await this.prisma.company
      .update({
        where: {
          id: companyId
        },
        data: {
          ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.syncStoreInventory !== undefined
            ? { syncStoreInventory: input.syncStoreInventory }
            : {})
        },
        include: {
          _count: {
            select: {
              apiKeys: true
            }
          },
          apiKeys: {
            select: {
              isRevoked: true
            }
          }
        }
      })
      .catch(() => null);

    return company ? mapCompany(company) : null;
  }

  async updateCompanyStatus(companyId: string, isActive: boolean) {
    return this.updateCompany(companyId, {
      isActive
    });
  }

  async deleteCompany(companyId: string) {
    const company = await this.prisma.company
      .delete({
        where: {
          id: companyId
        },
        include: {
          _count: {
            select: {
              apiKeys: true
            }
          },
          apiKeys: {
            select: {
              isRevoked: true
            }
          }
        }
      })
      .catch(() => null);

    return company ? mapCompany(company) : null;
  }

  async findCompanyById(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: {
        id: companyId
      },
      include: {
        _count: {
          select: {
            apiKeys: true
          }
        },
        apiKeys: {
          select: {
            isRevoked: true
          }
        }
      }
    });

    return company ? mapCompany(company) : null;
  }

  async listApiKeysByCompany(companyId: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        companyId
      },
      include: {
        company: {
          include: {
            _count: {
              select: {
                apiKeys: true
              }
            },
            apiKeys: {
              select: {
                isRevoked: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return apiKeys.map(mapApiKey);
  }

  async createApiKey(input: CreateApiKeyInput) {
    const apiKey = await this.prisma.apiKey.create({
      data: input,
      include: {
        company: {
          include: {
            _count: {
              select: {
                apiKeys: true
              }
            },
            apiKeys: {
              select: {
                isRevoked: true
              }
            }
          }
        }
      }
    });

    return mapApiKey(apiKey);
  }

  async revokeApiKey(apiKeyId: string) {
    const apiKey = await this.prisma.apiKey
      .update({
        where: {
          id: apiKeyId
        },
        data: {
          isRevoked: true,
          revokedAt: new Date()
        },
        include: {
          company: {
            include: {
              _count: {
                select: {
                  apiKeys: true
                }
              },
              apiKeys: {
                select: {
                  isRevoked: true
                }
              }
            }
          }
        }
      })
      .catch(() => null);

    return apiKey ? mapApiKey(apiKey) : null;
  }

  async findApiKeyByHash(keyHash: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: {
        keyHash
      },
      include: {
        company: {
          include: {
            _count: {
              select: {
                apiKeys: true
              }
            },
            apiKeys: {
              select: {
                isRevoked: true
              }
            }
          }
        }
      }
    });

    return apiKey ? mapApiKey(apiKey) : null;
  }

  async touchApiKeyUsage(apiKeyId: string, usedAt: Date) {
    await this.prisma.apiKey
      .update({
        where: {
          id: apiKeyId
        },
        data: {
          lastUsedAt: usedAt
        }
      })
      .catch(() => undefined);
  }

  async replaceMasterProducts(products: UpsertMasterProductInput[]) {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const productIds = products.map((product) => product.id);

      if (productIds.length > 0) {
        await tx.productVariant.deleteMany({
          where: {
            productId: {
              notIn: productIds
            }
          }
        });

        await tx.companyInventory.deleteMany({
          where: {
            productId: {
              notIn: productIds
            }
          }
        });

        await tx.masterProduct.deleteMany({
          where: {
            id: {
              notIn: productIds
            }
          }
        });
      } else {
        await tx.productVariant.deleteMany();
        await tx.companyInventory.deleteMany();
        await tx.masterProduct.deleteMany();
      }

      for (const product of products) {
        await tx.masterProduct.upsert({
          where: {
            id: product.id
          },
          update: {
            sku: product.sku,
            name: product.name,
            masterStock: product.masterStock,
            updatedAt: product.updatedAt
          },
          create: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            masterStock: product.masterStock,
            updatedAt: product.updatedAt
          }
        });

        const variantIds = (product.variants ?? []).map((variant) => variant.id);

        if (variantIds.length > 0) {
          await tx.productVariant.deleteMany({
            where: {
              productId: product.id,
              id: {
                notIn: variantIds
              }
            }
          });
        } else {
          await tx.productVariant.deleteMany({
            where: {
              productId: product.id
            }
          });
        }

        for (const variant of product.variants ?? []) {
          await tx.productVariant.upsert({
            where: {
              id: variant.id
            },
            update: {
              productId: product.id,
              sku: variant.sku,
              individualWeight: variant.individualWeight ?? null,
              individualStock: variant.individualStock,
              createdAt: variant.createdAt ?? new Date(),
              updatedAt: variant.updatedAt
            },
            create: {
              id: variant.id,
              productId: product.id,
              sku: variant.sku,
              individualWeight: variant.individualWeight ?? null,
              individualStock: variant.individualStock,
              createdAt: variant.createdAt ?? new Date(),
              updatedAt: variant.updatedAt
            }
          });
        }
      }
    });

    return this.listMasterProducts();
  }

  async listMasterProducts() {
    const products = await this.prisma.masterProduct.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }]
    });

    return products.map(mapMasterProduct);
  }

  async findMasterProductById(productId: string) {
    const product = await this.prisma.masterProduct.findUnique({
      where: {
        id: productId
      }
    });

    return product ? mapMasterProduct(product) : null;
  }

  async findMasterProductBySku(sku: string) {
    const product = await this.prisma.masterProduct.findFirst({
      where: {
        sku
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return product ? mapMasterProduct(product) : null;
  }

  async listProductVariantsByProductId(productId: string) {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        productId
      },
      orderBy: [{ createdAt: "asc" }, { sku: "asc" }]
    });

    return variants.map(mapProductVariant);
  }

  async getCostSettings(companyId?: string) {
    if (companyId) {
      const settings = await this.prisma.companyCostSettings.upsert({
        where: {
          companyId
        },
        update: {},
        create: {
          companyId
        }
      });

      return mapCostSettings({
        companyId: settings.companyId,
        silverPricePerGram: settings.silverPricePerGram,
        zonaFrancaRatePercent: settings.zonaFrancaRatePercent,
        transportFee: settings.transportFee,
        dollarRate: settings.dollarRate,
        updatedAt: settings.updatedAt
      });
    }

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "cost_settings" (
        "id",
        "silver_price_per_gram",
        "zona_franca_rate_percent",
        "transport_fee",
        "dollar_rate"
      )
      VALUES ('default', 1, 6, 0.1, 5)
      ON CONFLICT ("id") DO NOTHING
    `);

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        silverPricePerGram: number;
        zonaFrancaRatePercent: number;
        transportFee: number;
        dollarRate: number;
        updatedAt: Date;
      }>
    >(`
      SELECT
        "silver_price_per_gram" AS "silverPricePerGram",
        "zona_franca_rate_percent" AS "zonaFrancaRatePercent",
        "transport_fee" AS "transportFee",
        "dollar_rate" AS "dollarRate",
        "updated_at" AS "updatedAt"
      FROM "cost_settings"
      WHERE "id" = 'default'
      LIMIT 1
    `);

    const settings = rows[0];
    return mapCostSettings(settings);
  }

  async updateCostSettings(input: UpdateCostSettingsInput, companyId?: string) {
    const current = await this.getCostSettings(companyId);
    const nextSettings = {
      silverPricePerGram: input.silverPricePerGram ?? current.silverPricePerGram,
      zonaFrancaRatePercent: input.zonaFrancaRatePercent ?? current.zonaFrancaRatePercent,
      transportFee: input.transportFee ?? current.transportFee,
      dollarRate: input.dollarRate ?? current.dollarRate
    };
    const changedFields = [
      ...(nextSettings.silverPricePerGram !== current.silverPricePerGram
        ? ["silverPricePerGram"]
        : []),
      ...(nextSettings.zonaFrancaRatePercent !== current.zonaFrancaRatePercent
        ? ["zonaFrancaRatePercent"]
        : []),
      ...(nextSettings.transportFee !== current.transportFee ? ["transportFee"] : []),
      ...(nextSettings.dollarRate !== current.dollarRate ? ["dollarRate"] : [])
    ];

    if (changedFields.length === 0) {
      return current;
    }

    if (companyId) {
      const settings = await this.prisma.$transaction(async (tx) => {
        const updatedSettings = await tx.companyCostSettings.upsert({
          where: {
            companyId
          },
          update: {
            silverPricePerGram: nextSettings.silverPricePerGram,
            zonaFrancaRatePercent: nextSettings.zonaFrancaRatePercent,
            transportFee: nextSettings.transportFee,
            dollarRate: nextSettings.dollarRate
          },
          create: {
            companyId,
            silverPricePerGram: nextSettings.silverPricePerGram,
            zonaFrancaRatePercent: nextSettings.zonaFrancaRatePercent,
            transportFee: nextSettings.transportFee,
            dollarRate: nextSettings.dollarRate
          }
        });

        await tx.companyCostSettingsHistory.create({
          data: {
            companyId,
            previousSilverPricePerGram: current.silverPricePerGram,
            nextSilverPricePerGram: nextSettings.silverPricePerGram,
            previousZonaFrancaRatePercent: current.zonaFrancaRatePercent,
            nextZonaFrancaRatePercent: nextSettings.zonaFrancaRatePercent,
            previousTransportFee: current.transportFee,
            nextTransportFee: nextSettings.transportFee,
            previousDollarRate: current.dollarRate,
            nextDollarRate: nextSettings.dollarRate,
            changedFields: JSON.stringify(changedFields)
          }
        });

        return updatedSettings;
      });

      return mapCostSettings({
        companyId: settings.companyId,
        silverPricePerGram: settings.silverPricePerGram,
        zonaFrancaRatePercent: settings.zonaFrancaRatePercent,
        transportFee: settings.transportFee,
        dollarRate: settings.dollarRate,
        updatedAt: settings.updatedAt
      });
    }

    await this.prisma.$executeRawUnsafe(
      `
        UPDATE "cost_settings"
        SET
          "silver_price_per_gram" = $1,
          "zona_franca_rate_percent" = $2,
          "transport_fee" = $3,
          "dollar_rate" = $4,
          "updated_at" = NOW()
        WHERE "id" = 'default'
      `,
      nextSettings.silverPricePerGram,
      nextSettings.zonaFrancaRatePercent,
      nextSettings.transportFee,
      nextSettings.dollarRate
    );

    await this.prisma.$executeRawUnsafe(
      `
        INSERT INTO "cost_settings_history" (
          "id",
          "previous_silver_price_per_gram",
          "next_silver_price_per_gram",
          "previous_zona_franca_rate_percent",
          "next_zona_franca_rate_percent",
          "previous_transport_fee",
          "next_transport_fee",
          "previous_dollar_rate",
          "next_dollar_rate",
          "changed_fields"
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      crypto.randomUUID(),
      current.silverPricePerGram,
      nextSettings.silverPricePerGram,
      current.zonaFrancaRatePercent,
      nextSettings.zonaFrancaRatePercent,
      current.transportFee,
      nextSettings.transportFee,
      current.dollarRate,
      nextSettings.dollarRate,
      JSON.stringify(changedFields)
    );

    return this.getCostSettings();
  }

  async listCostSettingsHistory(limit = 50, companyId?: string) {
    if (companyId) {
      const rows = await this.prisma.companyCostSettingsHistory.findMany({
        where: {
          companyId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: limit
      });

      return rows.map((row) =>
        mapCostSettingsHistory({
          id: row.id,
          companyId: row.companyId,
          previousSilverPricePerGram: row.previousSilverPricePerGram,
          nextSilverPricePerGram: row.nextSilverPricePerGram,
          previousZonaFrancaRatePercent: row.previousZonaFrancaRatePercent,
          nextZonaFrancaRatePercent: row.nextZonaFrancaRatePercent,
          previousTransportFee: row.previousTransportFee,
          nextTransportFee: row.nextTransportFee,
          previousDollarRate: row.previousDollarRate,
          nextDollarRate: row.nextDollarRate,
          changedFields: row.changedFields,
          createdAt: row.createdAt
        })
      );
    }

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        previousSilverPricePerGram: number;
        nextSilverPricePerGram: number;
        previousZonaFrancaRatePercent: number;
        nextZonaFrancaRatePercent: number;
        previousTransportFee: number;
        nextTransportFee: number;
        previousDollarRate: number;
        nextDollarRate: number;
        changedFields: string;
        createdAt: Date;
      }>
    >(
      `
        SELECT
          "id",
          "previous_silver_price_per_gram" AS "previousSilverPricePerGram",
          "next_silver_price_per_gram" AS "nextSilverPricePerGram",
          "previous_zona_franca_rate_percent" AS "previousZonaFrancaRatePercent",
          "next_zona_franca_rate_percent" AS "nextZonaFrancaRatePercent",
          "previous_transport_fee" AS "previousTransportFee",
          "next_transport_fee" AS "nextTransportFee",
          "previous_dollar_rate" AS "previousDollarRate",
          "next_dollar_rate" AS "nextDollarRate",
          "changed_fields" AS "changedFields",
          "created_at" AS "createdAt"
        FROM "cost_settings_history"
        ORDER BY "created_at" DESC
        LIMIT $1
      `,
      limit
    );

    return rows.map(mapCostSettingsHistory);
  }

  async listEffectiveInventoryByCompany(companyId: string) {
    const products = await this.prisma.masterProduct.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        companyInventories: {
          where: {
            companyId
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 1
        },
        variants: {
          orderBy: [{ createdAt: "asc" }, { sku: "asc" }],
          include: {
            companyVariantInventories: {
              where: {
                companyId
              },
              orderBy: {
                updatedAt: "desc"
              },
              take: 1
            }
          }
        }
      }
    });

    return products.map(mapEffectiveInventory);
  }

  async upsertCompanyInventory(
    companyId: string,
    productId: string,
    customStockQuantity: number
  ) {
    const product = await this.prisma.$transaction(async (tx) => {
      const existingProduct = await tx.masterProduct.findUnique({
        where: {
          id: productId
        }
      });

      if (!existingProduct) {
        return null;
      }

      await tx.companyInventory.upsert({
        where: {
          companyId_productId: {
            companyId,
            productId
          }
        },
        update: {
          customStockQuantity
        },
        create: {
          companyId,
          productId,
          customStockQuantity
        }
      });

      return tx.masterProduct.findUnique({
        where: {
          id: productId
        },
        include: {
          companyInventories: {
            where: {
              companyId
            },
            orderBy: {
              updatedAt: "desc"
            },
            take: 1
          },
          variants: {
            orderBy: [{ createdAt: "asc" }, { sku: "asc" }],
            include: {
              companyVariantInventories: {
                where: {
                  companyId
                },
                orderBy: {
                  updatedAt: "desc"
                },
                take: 1
              }
            }
          }
        }
      });
    });

    return product ? mapEffectiveInventory(product) : null;
  }

  async deleteCompanyInventory(companyId: string, productId: string) {
    await this.prisma.companyInventory
      .delete({
        where: {
          companyId_productId: {
            companyId,
            productId
          }
        }
      })
      .catch(() => undefined);
  }

  async upsertCompanyVariantInventory(
    companyId: string,
    variantId: string,
    customStockQuantity: number
  ) {
    await this.prisma.companyVariantInventory.upsert({
      where: {
        companyId_variantId: {
          companyId,
          variantId
        }
      },
      update: {
        customStockQuantity
      },
      create: {
        companyId,
        variantId,
        customStockQuantity
      }
    });
  }
}
