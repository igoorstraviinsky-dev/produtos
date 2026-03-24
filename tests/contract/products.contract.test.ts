import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

import { afterEach, describe, it } from "node:test";
import YAML from "yaml";

import { deriveApiKeyPrefix, hashApiKey } from "../../src/utils/crypto";
import { createTestApp } from "../helpers/fakes";

describe("Products contract", () => {
  const appsToClose: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(appsToClose.splice(0).map((item) => item.close()));
  });

  it("matches the documented OpenAPI contract for GET /api/v1/products", async () => {
    const openApiDocument = YAML.parse(
      readFileSync(
        "C:\\Users\\goohf\\Desktop\\parceiros\\specs\\001-b2b-stock-gateway\\contracts\\openapi.yaml",
        "utf-8"
      )
    ) as {
      paths: Record<string, Record<string, unknown>>;
    };

    assert.ok(openApiDocument.paths["/api/v1/products"]);
    assert.ok(openApiDocument.paths["/api/v1/products"].get);

    const { app, controlPlane, env } = await createTestApp();
    appsToClose.push(app);

    const company = controlPlane.seedCompany({
      legalName: "Empresa Contrato",
      externalCode: "empresa-contrato"
    });
    const apiKey = "b2b_contract_key_123";

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

    const responseBody = response.json() as {
      data: unknown[];
      meta: { source: string; count: number };
    };

    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(responseBody.data));
    assert.match(responseBody.meta.source, /cache|upstream/);
    assert.equal(typeof responseBody.meta.count, "number");
  });
});
