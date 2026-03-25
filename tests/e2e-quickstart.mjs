import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

import Redis from "ioredis";

function loadDotEnv(filePath) {
  const result = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    result[key] = value;
  }

  return result;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(baseUrl, method, route, { headers = {}, body } = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...headers,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const durationMs = performance.now() - startedAt;
  const rawBody = await response.text();

  let parsedBody = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    durationMs,
    body: parsedBody
  };
}

function logResponse(label, response) {
  console.log(
    `${label}: status=${response.status} duration=${response.durationMs.toFixed(1)}ms`
  );

  if (response.body) {
    console.log(JSON.stringify(response.body, null, 2));
  }
}

async function waitForHealth(baseUrl) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await requestJson(baseUrl, "GET", "/health");
      if (response.status === 200) {
        console.log(`healthcheck: app responded on attempt ${attempt}`);
        return;
      }
    } catch {
      // Keep retrying while the server is starting.
    }

    await sleep(1000);
  }

  throw new Error("Application did not become healthy within 30 seconds");
}

async function main() {
  const envFile = path.join(process.cwd(), ".env");
  const envFromFile = loadDotEnv(envFile);
  const env = {
    ...envFromFile,
    ...process.env
  };

  const port = env.PORT || "3000";
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminToken = env.ADMIN_TOKEN;
  const redisUrl = env.REDIS_URL;

  assert(adminToken, "ADMIN_TOKEN is required");
  assert(redisUrl, "REDIS_URL is required");

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1
  });

  try {
    await redis.del("products:list:v1");
    console.log("redis: cleared products:list:v1");

    await waitForHealth(baseUrl);

    const adminHeaders = {
      "x-admin-token": adminToken
    };

    const uniqueSuffix = `${Date.now()}`;
    const createCompany = await requestJson(baseUrl, "POST", "/admin/companies", {
      headers: adminHeaders,
      body: {
        legalName: `Codex Test Company ${uniqueSuffix}`,
        externalCode: `codex-e2e-${uniqueSuffix}`
      }
    });
    logResponse("create-company", createCompany);
    assert(createCompany.status === 201, "Company creation failed");

    const companyId = createCompany.body?.data?.id;
    assert(companyId, "Company id was not returned");

    const issueApiKey = await requestJson(baseUrl, "POST", "/admin/api-keys", {
      headers: adminHeaders,
      body: {
        companyId,
        rateLimitPerMinute: 2
      }
    });
    logResponse("issue-api-key", issueApiKey);
    assert(issueApiKey.status === 201, "API key issuance failed");

    const apiKeyId = issueApiKey.body?.data?.apiKeyId;
    const plaintextKey = issueApiKey.body?.data?.plaintextKey;
    assert(apiKeyId, "API key id was not returned");
    assert(plaintextKey, "Plaintext API key was not returned");

    const issueInventoryApiKey = await requestJson(baseUrl, "POST", "/admin/api-keys", {
      headers: adminHeaders,
      body: {
        companyId,
        rateLimitPerMinute: 10
      }
    });
    logResponse("issue-inventory-api-key", issueInventoryApiKey);
    assert(issueInventoryApiKey.status === 201, "Inventory API key issuance failed");

    const inventoryPlaintextKey = issueInventoryApiKey.body?.data?.plaintextKey;
    assert(inventoryPlaintextKey, "Inventory plaintext API key was not returned");

    const bearerHeaders = {
      authorization: `Bearer ${plaintextKey}`
    };
    const inventoryBearerHeaders = {
      authorization: `Bearer ${inventoryPlaintextKey}`
    };

    const partnerInventoryBeforeUpdate = await requestJson(
      baseUrl,
      "GET",
      "/api/v1/my-inventory",
      {
        headers: inventoryBearerHeaders
      }
    );
    logResponse("my-inventory-before-update", partnerInventoryBeforeUpdate);
    assert(partnerInventoryBeforeUpdate.status === 200, "Partner inventory read failed");
    assert(
      Array.isArray(partnerInventoryBeforeUpdate.body?.data) &&
        partnerInventoryBeforeUpdate.body.data.length > 0,
      "Partner inventory should return at least one product"
    );

    const inventoryProductId = partnerInventoryBeforeUpdate.body.data[0].productId;
    const nextCustomStockQuantity =
      Number(partnerInventoryBeforeUpdate.body.data[0].effectiveStockQuantity ?? 0) + 3;

    const partnerInventoryUpdate = await requestJson(
      baseUrl,
      "PATCH",
      `/api/v1/my-inventory/${inventoryProductId}`,
      {
        headers: inventoryBearerHeaders,
        body: {
          custom_stock_quantity: nextCustomStockQuantity
        }
      }
    );
    logResponse("my-inventory-update", partnerInventoryUpdate);
    assert(partnerInventoryUpdate.status === 200, "Partner inventory update failed");
    assert(
      partnerInventoryUpdate.body?.data?.customStockQuantity === nextCustomStockQuantity,
      "Partner inventory update did not persist the custom quantity"
    );

    const partnerInventoryAfterUpdate = await requestJson(
      baseUrl,
      "GET",
      "/api/v1/my-inventory",
      {
        headers: inventoryBearerHeaders
      }
    );
    logResponse("my-inventory-after-update", partnerInventoryAfterUpdate);
    assert(
      partnerInventoryAfterUpdate.status === 200,
      "Partner inventory read after update failed"
    );

    const updatedPartnerProduct = partnerInventoryAfterUpdate.body?.data?.find(
      (item) => item.productId === inventoryProductId
    );
    assert(updatedPartnerProduct, "Updated partner inventory product was not returned");
    assert(
      updatedPartnerProduct.customStockQuantity === nextCustomStockQuantity,
      "Partner inventory GET did not return the saved custom quantity"
    );

    const firstProductsCall = await requestJson(baseUrl, "GET", "/api/v1/products", {
      headers: bearerHeaders
    });
    logResponse("products-call-1", firstProductsCall);
    assert(firstProductsCall.status === 200, "First products call failed");
    assert(
      firstProductsCall.body?.meta?.source === "upstream",
      "First products call did not come from upstream"
    );

    const secondProductsCall = await requestJson(baseUrl, "GET", "/api/v1/products", {
      headers: bearerHeaders
    });
    logResponse("products-call-2", secondProductsCall);
    assert(secondProductsCall.status === 200, "Second products call failed");
    assert(
      secondProductsCall.body?.meta?.source === "cache",
      "Second products call did not come from cache"
    );

    console.log(
      `cache-check: first=${firstProductsCall.durationMs.toFixed(1)}ms second=${secondProductsCall.durationMs.toFixed(1)}ms`
    );

    const thirdProductsCall = await requestJson(baseUrl, "GET", "/api/v1/products", {
      headers: bearerHeaders
    });
    logResponse("products-call-3", thirdProductsCall);
    assert(thirdProductsCall.status === 429, "Third products call should be rate limited");

    const fourthProductsCall = await requestJson(baseUrl, "GET", "/api/v1/products", {
      headers: bearerHeaders
    });
    logResponse("products-call-4", fourthProductsCall);
    assert(fourthProductsCall.status === 429, "Fourth products call should be rate limited");

    const deactivateCompany = await requestJson(
      baseUrl,
      "PATCH",
      `/admin/companies/${companyId}/status`,
      {
        headers: adminHeaders,
        body: {
          isActive: false
        }
      }
    );
    logResponse("deactivate-company", deactivateCompany);
    assert(deactivateCompany.status === 200, "Company deactivation failed");

    const blockedByCompany = await requestJson(baseUrl, "GET", "/api/v1/products", {
      headers: bearerHeaders
    });
    logResponse("products-blocked-company", blockedByCompany);
    assert(blockedByCompany.status === 403, "Inactive company should be blocked");
    assert(
      blockedByCompany.body?.error === "COMPANY_INACTIVE",
      "Inactive company returned an unexpected error code"
    );

    const reactivateCompany = await requestJson(
      baseUrl,
      "PATCH",
      `/admin/companies/${companyId}/status`,
      {
        headers: adminHeaders,
        body: {
          isActive: true
        }
      }
    );
    logResponse("reactivate-company", reactivateCompany);
    assert(reactivateCompany.status === 200, "Company reactivation failed");

    const revokeApiKey = await requestJson(
      baseUrl,
      "PATCH",
      `/admin/api-keys/${apiKeyId}/revoke`,
      {
        headers: adminHeaders
      }
    );
    logResponse("revoke-api-key", revokeApiKey);
    assert(revokeApiKey.status === 200, "API key revocation failed");

    const blockedByRevokedKey = await requestJson(baseUrl, "GET", "/api/v1/products", {
      headers: bearerHeaders
    });
    logResponse("products-blocked-revoked-key", blockedByRevokedKey);
    assert(blockedByRevokedKey.status === 403, "Revoked API key should be blocked");
    assert(
      blockedByRevokedKey.body?.error === "API_KEY_REVOKED",
      "Revoked API key returned an unexpected error code"
    );

    const finalSummary = {
      companyId,
      apiKeyId,
      inventoryApiKeyId: issueInventoryApiKey.body?.data?.apiKeyId,
      inventoryProductId,
      partnerInventoryInitialCount: partnerInventoryBeforeUpdate.body?.meta?.count,
      partnerInventoryUpdatedQuantity: updatedPartnerProduct.customStockQuantity,
      firstCallSource: firstProductsCall.body?.meta?.source,
      secondCallSource: secondProductsCall.body?.meta?.source,
      productCountFirstCall: firstProductsCall.body?.meta?.count,
      firstCallMs: Number(firstProductsCall.durationMs.toFixed(1)),
      secondCallMs: Number(secondProductsCall.durationMs.toFixed(1)),
      thirdCallStatus: thirdProductsCall.status,
      fourthCallStatus: fourthProductsCall.status,
      blockedByCompanyCode: blockedByCompany.body?.error,
      blockedByRevokedKeyCode: blockedByRevokedKey.body?.error
    };

    console.log("summary:");
    console.log(JSON.stringify(finalSummary, null, 2));
  } finally {
    await redis.quit().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("e2e-quickstart failed");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
