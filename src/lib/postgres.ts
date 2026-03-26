import crypto from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

export type CompanyRecord = {
  id: string;
  legalName: string;
  externalCode: string;
  isActive: boolean;
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
  silverPricePerGram: number;
  zonaFrancaRatePercent: number;
  transportFee: number;
  dollarRate: number;
  updatedAt: Date;
};

export type CostSettingsHistoryRecord = {
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
  getCostSettings(): Promise<CostSettingsRecord>;
  updateCostSettings(input: UpdateCostSettingsInput): Promise<CostSettingsRecord>;
  listCostSettingsHistory(limit?: number): Promise<CostSettingsHistoryRecord[]>;
  listEffectiveInventoryByCompany(companyId: string): Promise<EffectiveInventoryRecord[]>;
  upsertCompanyInventory(
    companyId: string,
    productId: string,
    customStockQuantity: number
  ): Promise<EffectiveInventoryRecord | null>;
}

function mapCompany(company: CompanyWithCounts): CompanyRecord {
  return {
    id: company.id,
    legalName: company.legalName,
    externalCode: company.externalCode,
    isActive: company.isActive,
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
  silverPricePerGram: number;
  zonaFrancaRatePercent: number;
  transportFee: number;
  dollarRate: number;
  updatedAt: Date;
}): CostSettingsRecord {
  return {
    silverPricePerGram: settings.silverPricePerGram,
    zonaFrancaRatePercent: settings.zonaFrancaRatePercent,
    transportFee: settings.transportFee,
    dollarRate: settings.dollarRate,
    updatedAt: settings.updatedAt
  };
}

function mapCostSettingsHistory(history: {
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
}): CostSettingsHistoryRecord {
  return {
    id: history.id,
    previousSilverPricePerGram: history.previousSilverPricePerGram,
    nextSilverPricePerGram: history.nextSilverPricePerGram,
    previousZonaFrancaRatePercent: history.previousZonaFrancaRatePercent,
    nextZonaFrancaRatePercent: history.nextZonaFrancaRatePercent,
    previousTransportFee: history.previousTransportFee,
    nextTransportFee: history.nextTransportFee,
    previousDollarRate: history.previousDollarRate,
    nextDollarRate: history.nextDollarRate,
    changedFields: JSON.parse(history.changedFields) as string[],
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
}): EffectiveInventoryRecord {
  const companyInventory = product.companyInventories[0] ?? null;

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    masterStock: product.masterStock,
    customStockQuantity: companyInventory?.customStockQuantity ?? null,
    effectiveStockQuantity: companyInventory?.customStockQuantity ?? product.masterStock,
    updatedAt: companyInventory?.updatedAt ?? product.updatedAt
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
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
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

  async getCostSettings() {
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

  async updateCostSettings(input: UpdateCostSettingsInput) {
    const current = await this.getCostSettings();
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

  async listCostSettingsHistory(limit = 50) {
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
          }
        }
      });
    });

    return product ? mapEffectiveInventory(product) : null;
  }
}
