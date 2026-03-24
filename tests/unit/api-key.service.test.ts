import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiKeyService } from "../../src/modules/auth/api-key.service";
import { deriveApiKeyPrefix, hashApiKey } from "../../src/utils/crypto";
import { FakeControlPlaneRepository, createTestEnv } from "../helpers/fakes";

describe("ApiKeyService", () => {
  it("authenticates a valid API key", async () => {
    const env = createTestEnv();
    const repo = new FakeControlPlaneRepository();
    const company = repo.seedCompany({
      legalName: "Empresa Teste",
      externalCode: "empresa-teste"
    });
    const plaintextKey = "b2b_valid_key_123";

    repo.seedApiKey({
      companyId: company.id,
      keyPrefix: deriveApiKeyPrefix(plaintextKey),
      keyHash: hashApiKey(plaintextKey, env.API_KEY_PEPPER),
      rateLimitPerMinute: 30
    });

    const service = new ApiKeyService(repo, env.API_KEY_PEPPER);
    const authContext = await service.authenticatePresentedKey(plaintextKey);

    assert.equal(authContext.companyId, company.id);
    assert.equal(authContext.rateLimitPerMinute, 30);
    assert.equal(authContext.keyPrefix, deriveApiKeyPrefix(plaintextKey));
  });

  it("rejects revoked API keys", async () => {
    const env = createTestEnv();
    const repo = new FakeControlPlaneRepository();
    const company = repo.seedCompany({
      legalName: "Empresa Teste",
      externalCode: "empresa-teste"
    });
    const plaintextKey = "b2b_revoked_key_123";

    repo.seedApiKey({
      companyId: company.id,
      keyPrefix: deriveApiKeyPrefix(plaintextKey),
      keyHash: hashApiKey(plaintextKey, env.API_KEY_PEPPER),
      rateLimitPerMinute: 30,
      isRevoked: true
    });

    const service = new ApiKeyService(repo, env.API_KEY_PEPPER);

    await assert.rejects(service.authenticatePresentedKey(plaintextKey), {
      code: "API_KEY_REVOKED",
      statusCode: 403
    });
  });
});
