import { ControlPlaneRepository } from "../../lib/postgres";
import { AppError } from "../../middleware/error-handler";
import { deriveApiKeyPrefix, hashApiKey } from "../../utils/crypto";
import { AuthContext } from "./auth.types";

type CachedAuthRecord = {
  expiresAt: number;
  authContext: AuthContext;
};

export class ApiKeyService {
  private readonly authCache = new Map<string, CachedAuthRecord>();
  private readonly authCacheTtlMs = 15_000;

  constructor(
    private readonly controlPlane: ControlPlaneRepository,
    private readonly pepper: string
  ) {}

  private recordApiKeyUsage(apiKeyId: string) {
    void this.controlPlane.touchApiKeyUsage(apiKeyId, new Date()).catch(() => undefined);
  }

  async authenticatePresentedKey(apiKey: string): Promise<AuthContext> {
    const keyHash = hashApiKey(apiKey, this.pepper);
    const now = Date.now();
    const cached = this.authCache.get(keyHash);

    if (cached && cached.expiresAt > now) {
      return cached.authContext;
    }

    const apiKeyRecord = await this.controlPlane.findApiKeyByHash(keyHash);

    if (!apiKeyRecord) {
      throw new AppError(401, "INVALID_API_KEY", "API key is invalid");
    }

    if (apiKeyRecord.keyPrefix !== deriveApiKeyPrefix(apiKey)) {
      throw new AppError(401, "INVALID_API_KEY", "API key is invalid");
    }

    if (!apiKeyRecord.company.isActive) {
      throw new AppError(403, "COMPANY_INACTIVE", "Company access is blocked");
    }

    if (apiKeyRecord.isRevoked) {
      throw new AppError(403, "API_KEY_REVOKED", "API key has been revoked");
    }

    this.recordApiKeyUsage(apiKeyRecord.id);

    const authContext = {
      apiKeyId: apiKeyRecord.id,
      companyId: apiKeyRecord.companyId,
      companyExternalCode: apiKeyRecord.company.externalCode,
      companyName: apiKeyRecord.company.legalName,
      companyIsActive: apiKeyRecord.company.isActive,
      companySyncStoreInventory: apiKeyRecord.company.syncStoreInventory,
      companyApiKeyCount: apiKeyRecord.company.apiKeyCount,
      companyActiveKeyCount: apiKeyRecord.company.activeKeyCount,
      companyCreatedAt: apiKeyRecord.company.createdAt.toISOString(),
      companyUpdatedAt: apiKeyRecord.company.updatedAt.toISOString(),
      keyPrefix: apiKeyRecord.keyPrefix,
      rateLimitPerMinute: apiKeyRecord.rateLimitPerMinute
    } satisfies AuthContext;

    this.authCache.set(keyHash, {
      expiresAt: now + this.authCacheTtlMs,
      authContext
    });

    return authContext;
  }
}
