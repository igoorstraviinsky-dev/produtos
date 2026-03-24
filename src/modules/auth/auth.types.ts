import "fastify";

export type AuthContext = {
  apiKeyId: string;
  companyId: string;
  companyExternalCode: string;
  companyName: string;
  keyPrefix: string;
  rateLimitPerMinute: number;
};

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}
