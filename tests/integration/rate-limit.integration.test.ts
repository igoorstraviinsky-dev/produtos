import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { deriveApiKeyPrefix, hashApiKey } from "../../src/utils/crypto";
import { createTestApp } from "../helpers/fakes";

describe("Rate limiting integration", () => {
  const appsToClose: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(appsToClose.splice(0).map((item) => item.close()));
  });

  it("blocks requests above the configured limit", async () => {
    const { app, controlPlane, env } = await createTestApp();
    appsToClose.push(app);

    const company = controlPlane.seedCompany({
      legalName: "Empresa Limitada",
      externalCode: "empresa-limitada"
    });
    const apiKey = "b2b_rate_limit_123";

    controlPlane.seedApiKey({
      companyId: company.id,
      keyPrefix: deriveApiKeyPrefix(apiKey),
      keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
      rateLimitPerMinute: 1
    });

    const firstResponse = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    const secondResponse = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 429);
  });
});
