import { ControlPlaneRepository } from "../../lib/postgres";
import { AppError } from "../../middleware/error-handler";
import { deriveApiKeyPrefix, hashApiKey } from "../../utils/crypto";
import { AuthContext } from "./auth.types";

export class ApiKeyService {
  constructor(
    private readonly controlPlane: ControlPlaneRepository,
    private readonly pepper: string
  ) {}

  async authenticatePresentedKey(apiKey: string): Promise<AuthContext> {
    const keyHash = hashApiKey(apiKey, this.pepper);
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

    await this.controlPlane.touchApiKeyUsage(apiKeyRecord.id, new Date());

    return {
      apiKeyId: apiKeyRecord.id,
      companyId: apiKeyRecord.companyId,
      companyExternalCode: apiKeyRecord.company.externalCode,
      companyName: apiKeyRecord.company.legalName,
      keyPrefix: apiKeyRecord.keyPrefix,
      rateLimitPerMinute: apiKeyRecord.rateLimitPerMinute
    };
  }
}
