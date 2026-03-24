import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { deriveApiKeyPrefix, hashApiKey } from "../../src/utils/crypto";
import { createTestApp } from "../helpers/fakes";

describe("Authentication integration", () => {
  const appsToClose: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(appsToClose.splice(0).map((item) => item.close()));
  });

  it("rejects missing bearer token", async () => {
    const { app } = await createTestApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products"
    });

    assert.equal(response.statusCode, 401);
  });

  it("rejects inactive companies", async () => {
    const { app, controlPlane, env } = await createTestApp();
    appsToClose.push(app);

    const company = controlPlane.seedCompany({
      legalName: "Empresa Inativa",
      externalCode: "empresa-inativa",
      isActive: false
    });
    const apiKey = "b2b_company_inactive_123";

    controlPlane.seedApiKey({
      companyId: company.id,
      keyPrefix: deriveApiKeyPrefix(apiKey),
      keyHash: hashApiKey(apiKey, env.API_KEY_PEPPER),
      rateLimitPerMinute: 10
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    assert.equal(response.statusCode, 403);
  });
});
