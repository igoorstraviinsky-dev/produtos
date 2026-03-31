import "fastify";

export type AuthContext = {
  apiKeyId: string;
  companyId: string;
  companyExternalCode: string;
  companyName: string;
  companyIsActive: boolean;
  companySyncStoreInventory: boolean;
  companyApiKeyCount: number;
  companyActiveKeyCount: number;
  companyCreatedAt: string;
  companyUpdatedAt: string;
  keyPrefix: string;
  rateLimitPerMinute: number;
};

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}
