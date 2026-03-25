import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createTestApp } from "../helpers/fakes";

describe("Admin integration", () => {
  const appsToClose: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(appsToClose.splice(0).map((item) => item.close()));
  });

  it("creates companies, issues keys, deactivates companies and revokes keys", async () => {
    const { app } = await createTestApp({
      env: {
        ADMIN_TOKEN: "secret-token"
      }
    });
    appsToClose.push(app);

    const companyResponse = await app.inject({
      method: "POST",
      url: "/admin/companies",
      headers: {
        "x-admin-token": "secret-token"
      },
      payload: {
        legalName: "Empresa Admin",
        externalCode: "empresa-admin"
      }
    });

    assert.equal(companyResponse.statusCode, 201);
    const companyId = companyResponse.json().data.id as string;

    const apiKeyResponse = await app.inject({
      method: "POST",
      url: "/admin/api-keys",
      headers: {
        "x-admin-token": "secret-token"
      },
      payload: {
        companyId,
        rateLimitPerMinute: 15
      }
    });

    assert.equal(apiKeyResponse.statusCode, 201);
    assert.match(apiKeyResponse.json().data.plaintextKey as string, /b2b_/);
    const apiKeyId = apiKeyResponse.json().data.apiKeyId as string;

    const deactivateResponse = await app.inject({
      method: "PATCH",
      url: `/admin/companies/${companyId}/status`,
      headers: {
        "x-admin-token": "secret-token"
      },
      payload: {
        isActive: false
      }
    });

    assert.equal(deactivateResponse.statusCode, 200);
    assert.equal(deactivateResponse.json().data.isActive, false);

    const revokeResponse = await app.inject({
      method: "PATCH",
      url: `/admin/api-keys/${apiKeyId}/revoke`,
      headers: {
        "x-admin-token": "secret-token"
      }
    });

    assert.equal(revokeResponse.statusCode, 200);
    assert.equal(revokeResponse.json().data.isRevoked, true);
  });

  it("reads and updates persisted cost settings for product cost calculation", async () => {
    const { app } = await createTestApp({
      env: {
        ADMIN_TOKEN: "secret-token"
      }
    });
    appsToClose.push(app);

    const initialResponse = await app.inject({
      method: "GET",
      url: "/api/internal/admin/cost-settings",
      headers: {
        "x-admin-token": "secret-token"
      }
    });

    assert.equal(initialResponse.statusCode, 200);
    assert.equal(initialResponse.json().data.dollarRate, 5);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/api/internal/admin/cost-settings",
      headers: {
        "x-admin-token": "secret-token"
      },
      payload: {
        silverPricePerGram: 1.25,
        zonaFrancaRatePercent: 7,
        transportFee: 0.25,
        dollarRate: 5.5
      }
    });

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.json().data.silverPricePerGram, 1.25);
    assert.equal(updateResponse.json().data.dollarRate, 5.5);

    const historyResponse = await app.inject({
      method: "GET",
      url: "/api/internal/admin/cost-settings/history",
      headers: {
        "x-admin-token": "secret-token"
      }
    });

    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.json().data.length, 1);
    assert.deepEqual(historyResponse.json().data[0].changedFields.sort(), [
      "dollarRate",
      "silverPricePerGram",
      "transportFee",
      "zonaFrancaRatePercent"
    ]);
  });
});
