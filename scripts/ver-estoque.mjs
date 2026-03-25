import fs from "node:fs";
import path from "node:path";
import process from "node:process";

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

async function requestJson(baseUrl, method, route, { headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...headers,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const rawText = await response.text();
  const json = rawText ? JSON.parse(rawText) : null;

  return {
    status: response.status,
    body: json
  };
}

async function getOrCreateCompany(baseUrl, adminToken) {
  const companiesResponse = await requestJson(baseUrl, "GET", "/admin/companies", {
    headers: {
      "x-admin-token": adminToken
    }
  });

  assert(companiesResponse.status === 200, "Nao foi possivel listar empresas");

  const activeCompany = companiesResponse.body?.data?.find((company) => company.isActive);
  if (activeCompany) {
    return activeCompany;
  }

  const uniqueSuffix = Date.now();
  const createCompanyResponse = await requestJson(baseUrl, "POST", "/admin/companies", {
    headers: {
      "x-admin-token": adminToken
    },
    body: {
      legalName: `Terminal Stock Viewer ${uniqueSuffix}`,
      externalCode: `terminal-stock-${uniqueSuffix}`
    }
  });

  assert(createCompanyResponse.status === 201, "Nao foi possivel criar empresa");
  return createCompanyResponse.body.data;
}

async function issueApiKey(baseUrl, adminToken, companyId) {
  const issueResponse = await requestJson(baseUrl, "POST", "/admin/api-keys", {
    headers: {
      "x-admin-token": adminToken
    },
    body: {
      companyId,
      rateLimitPerMinute: 20
    }
  });

  assert(issueResponse.status === 201, "Nao foi possivel gerar API key");
  return issueResponse.body.data;
}

async function main() {
  const env = {
    ...loadDotEnv(path.join(process.cwd(), ".env")),
    ...process.env
  };

  const port = env.PORT || "3000";
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminToken = env.ADMIN_TOKEN;

  assert(adminToken, "ADMIN_TOKEN nao encontrado no .env");

  const company = await getOrCreateCompany(baseUrl, adminToken);
  const issuedKey = await issueApiKey(baseUrl, adminToken, company.id);

  const productsResponse = await requestJson(baseUrl, "GET", "/api/v1/products", {
    headers: {
      authorization: `Bearer ${issuedKey.plaintextKey}`
    }
  });

  console.log("Empresa usada:");
  console.log({
    id: company.id,
    legalName: company.legalName,
    externalCode: company.externalCode
  });

  console.log("\nAPI key gerada para inspecao:");
  console.log({
    apiKeyId: issuedKey.apiKeyId,
    keyPrefix: issuedKey.keyPrefix,
    plaintextKey: issuedKey.plaintextKey
  });

  console.log(`\nStatus HTTP: ${productsResponse.status}`);

  if (productsResponse.status !== 200) {
    console.log("Resposta de erro:");
    console.dir(productsResponse.body, { depth: null });
    process.exit(1);
  }

  const products = productsResponse.body.data;

  console.log("\nTabela resumida:");
  console.table(
    products.map((product) => ({
      nome: product.name,
      numero_serie: product.serialNumber,
      sku_serie: product.sku,
      categoria: product.category,
      subcategoria: product.subcategory,
      material: product.baseMaterial,
      pureza: product.purity,
      estoque: product.availableQuantity,
      status: product.status,
      preco: product.price,
      updated_at: product.updatedAt
    }))
  );

  console.log("\nPayload completo:");
  console.dir(productsResponse.body, { depth: null });
}

main().catch((error) => {
  console.error("Falha ao visualizar estoque");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
