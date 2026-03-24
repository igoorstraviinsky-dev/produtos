import { PrismaClient } from "@prisma/client";

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
  findCompanyById(companyId: string): Promise<CompanyRecord | null>;
  listApiKeysByCompany(companyId: string): Promise<ApiKeyRecord[]>;
  createApiKey(input: CreateApiKeyInput): Promise<ApiKeyRecord>;
  revokeApiKey(apiKeyId: string): Promise<ApiKeyRecord | null>;
  findApiKeyByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  touchApiKeyUsage(apiKeyId: string, usedAt: Date): Promise<void>;
  replaceMasterProducts(products: UpsertMasterProductInput[]): Promise<MasterProductRecord[]>;
  listMasterProducts(): Promise<MasterProductRecord[]>;
  findMasterProductById(productId: string): Promise<MasterProductRecord | null>;
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
    await this.prisma.$transaction(async (tx) => {
      const productIds = products.map((product) => product.id);

      if (productIds.length > 0) {
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
    const existingProduct = await this.prisma.masterProduct.findUnique({
      where: {
        id: productId
      }
    });

    if (!existingProduct) {
      return null;
    }

    await this.prisma.companyInventory.upsert({
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

    const product = await this.prisma.masterProduct.findUnique({
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

    return product ? mapEffectiveInventory(product) : null;
  }
}
