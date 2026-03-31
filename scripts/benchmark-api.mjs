import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import autocannon from "autocannon";

const DEFAULT_CONNECTION_STAGES = [5, 10, 25, 50, 100];
const DEFAULT_DURATION_SECONDS = 15;
const DEFAULT_TIMEOUT_SECONDS = 15;
const DEFAULT_WARMUP_SECONDS = 5;
const DEFAULT_SAFE_P95_MS = 800;
const DEFAULT_SAFE_ERROR_RATE = 0.01;
const DEFAULT_SAFETY_FACTOR = 0.7;
const EXIT_CODE_UNSAFE = 2;

function printHelp() {
  console.log(`Benchmark de carga da API

Uso:
  npm run benchmark:api -- --base-url https://seu-dominio --api-key SUA_API_KEY

Variaveis de ambiente suportadas:
  API_BASE_URL
  API_KEY
  BENCH_CONNECTIONS=5,10,25,50,100
  BENCH_DURATION_SECONDS=15
  BENCH_WARMUP_SECONDS=5
  BENCH_TIMEOUT_SECONDS=15
  BENCH_SAFE_P95_MS=800
  BENCH_SAFE_ERROR_RATE=0.01
  BENCH_SAFETY_FACTOR=0.7

Exemplo PowerShell:
  $env:API_BASE_URL='https://estoque2.straviinsky.online'
  $env:API_KEY='sua_api_key'
  npm run benchmark:api
`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseConnections(value) {
  if (!value) {
    return DEFAULT_CONNECTION_STAGES;
  }

  const parsed = String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return parsed.length > 0 ? parsed : DEFAULT_CONNECTION_STAGES;
}

function ensureBaseUrl(value) {
  if (!value) {
    throw new Error(
      "Defina API_BASE_URL ou passe --base-url https://seu-dominio para executar o benchmark."
    );
  }

  return value.replace(/\/+$/, "");
}

function buildTarget(baseUrl, routePath) {
  return `${baseUrl}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function runAutocannon(options) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });

    instance.on("error", reject);
  });
}

function calculateErrorRate(result) {
  const totalRequests = result.requests?.total ?? 0;
  if (!totalRequests) {
    return 1;
  }

  const failedRequests =
    (result.errors ?? 0) +
    (result.timeouts ?? 0) +
    (result.non2xx ?? 0) +
    (result.mismatches ?? 0) +
    (result.resets ?? 0);

  return failedRequests / totalRequests;
}

function readP95Latency(result) {
  const latency = result.latency ?? {};
  return latency.p95 ?? latency.p97_5 ?? latency.p99 ?? latency.average ?? 0;
}

function formatNumber(value, digits = 2) {
  return Number(value ?? 0).toFixed(digits);
}

function countStatusFamily(result, family) {
  return Object.entries(result)
    .filter(([status]) => status.startsWith(String(family)))
    .reduce((total, [, count]) => total + Number(count ?? 0), 0);
}

function classifyStage(result, thresholds) {
  const errorRate = calculateErrorRate(result);
  const p95 = readP95Latency(result);
  const requestsPerSecond = result.requests?.average ?? 0;
  const passed =
    errorRate <= thresholds.maxErrorRate &&
    p95 <= thresholds.maxP95Ms &&
    (result.timeouts ?? 0) === 0 &&
    (result.errors ?? 0) === 0 &&
    (result.non2xx ?? 0) === 0;

  return {
    passed,
    errorRate,
    p95,
    requestsPerSecond,
    recommendedRps: passed ? Math.floor(requestsPerSecond * thresholds.safetyFactor) : 0
  };
}

function detectWarnings(stages) {
  const warnings = [];
  const saw429 = stages.some((stage) => (stage.result["429"] ?? 0) > 0);
  const saw5xx = stages.some((stage) => countStatusFamily(stage.result, 5) > 0);
  const sawTimeouts = stages.some((stage) => (stage.result.timeouts ?? 0) > 0);

  if (saw429) {
    warnings.push(
      "A rota respondeu 429 em pelo menos uma etapa. O benchmark pode estar medindo o rate limit da API key em vez da capacidade real do backend."
    );
  }

  if (saw5xx) {
    warnings.push(
      "A rota respondeu 5xx em pelo menos uma etapa. Isso indica falha real do backend ou do upstream sob carga."
    );
  }

  if (sawTimeouts) {
    warnings.push("Houve timeout em pelo menos uma etapa. O limite seguro deve ser tratado com margem adicional.");
  }

  return warnings;
}

function buildMarkdownReport(summary) {
  const lines = [];
  lines.push("# Benchmark de Carga da API");
  lines.push("");
  lines.push(`- Base URL: \`${summary.baseUrl}\``);
  lines.push(`- Data: \`${summary.generatedAt}\``);
  lines.push(`- Duracao por etapa: \`${summary.durationSeconds}s\``);
  lines.push(`- Warmup por etapa: \`${summary.warmupSeconds}s\``);
  lines.push(`- Conexoes testadas: \`${summary.connectionStages.join(", ")}\``);
  lines.push(
    `- Criterio de aprovacao: \`p95 <= ${summary.thresholds.maxP95Ms}ms\`, \`erro <= ${formatNumber(summary.thresholds.maxErrorRate * 100)}%\`, sem timeout e sem respostas nao-2xx`
  );
  lines.push("");
  lines.push("## Limite Seguro");
  lines.push("");
  lines.push("| Rota | Melhor etapa segura | RPS medio | Recomendacao segura | p95 |");
  lines.push("|------|---------------------|-----------|----------------------|-----|");

  for (const routeSummary of summary.routes) {
    if (!routeSummary.safeStage) {
      lines.push(`| \`${routeSummary.path}\` | Nenhuma | 0 | 0 | - |`);
      continue;
    }

    lines.push(
      `| \`${routeSummary.path}\` | ${routeSummary.safeStage.connections} conexoes | ${formatNumber(routeSummary.safeStage.requestsPerSecond)} | ${routeSummary.safeStage.recommendedRps} req/s | ${formatNumber(routeSummary.safeStage.p95)} ms |`
    );
  }

  lines.push("");
  lines.push("## Etapas");
  lines.push("");

  for (const routeSummary of summary.routes) {
    lines.push(`### ${routeSummary.path}`);
    lines.push("");

    if (routeSummary.warnings.length > 0) {
      lines.push("Avisos:");
      for (const warning of routeSummary.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push("");
    }

    lines.push("| Conexoes | Status | RPS medio | p95 | Erro % | 2xx | 4xx | 5xx |");
    lines.push("|----------|--------|-----------|-----|--------|-----|-----|-----|");

    for (const stage of routeSummary.stages) {
      lines.push(
        `| ${stage.connections} | ${stage.passed ? "OK" : "FALHOU"} | ${formatNumber(stage.requestsPerSecond)} | ${formatNumber(stage.p95)} ms | ${formatNumber(stage.errorRate * 100)} | ${countStatusFamily(stage.result, 2)} | ${countStatusFamily(stage.result, 4)} | ${countStatusFamily(stage.result, 5)} |`
      );
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    printHelp();
    return;
  }

  const baseUrl = ensureBaseUrl(args["base-url"] ?? process.env.API_BASE_URL);
  const apiKey = args["api-key"] ?? process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Defina API_KEY ou passe --api-key para autenticar as rotas protegidas.");
  }

  const connectionStages = parseConnections(args.connections ?? process.env.BENCH_CONNECTIONS);
  const durationSeconds = parseNumber(
    args.duration ?? process.env.BENCH_DURATION_SECONDS,
    DEFAULT_DURATION_SECONDS
  );
  const warmupSeconds = parseNumber(
    args.warmup ?? process.env.BENCH_WARMUP_SECONDS,
    DEFAULT_WARMUP_SECONDS
  );
  const timeoutSeconds = parseNumber(
    args.timeout ?? process.env.BENCH_TIMEOUT_SECONDS,
    DEFAULT_TIMEOUT_SECONDS
  );
  const thresholds = {
    maxP95Ms: parseNumber(
      args["safe-p95-ms"] ?? process.env.BENCH_SAFE_P95_MS,
      DEFAULT_SAFE_P95_MS
    ),
    maxErrorRate: parseNumber(
      args["safe-error-rate"] ?? process.env.BENCH_SAFE_ERROR_RATE,
      DEFAULT_SAFE_ERROR_RATE
    ),
    safetyFactor: parseNumber(
      args["safety-factor"] ?? process.env.BENCH_SAFETY_FACTOR,
      DEFAULT_SAFETY_FACTOR
    )
  };

  const routes = [
    { path: "/api/v1/products", name: "Catalogo autenticado" },
    { path: "/api/v1/companyid", name: "Catalogo consolidado da empresa" },
    { path: "/api/v1/my-inventory", name: "Inventario da empresa" }
  ];

  const commonOptions = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    pipelining: 1,
    timeout: timeoutSeconds
  };

  const routeSummaries = [];

  for (const route of routes) {
    console.log(`\n# Benchmark ${route.path}`);
    const stages = [];

    for (const connections of connectionStages) {
      const targetUrl = buildTarget(baseUrl, route.path);
      console.log(`- warmup ${connections} conexoes por ${warmupSeconds}s`);
      await runAutocannon({
        ...commonOptions,
        url: targetUrl,
        connections,
        duration: warmupSeconds
      });

      console.log(`- medindo ${connections} conexoes por ${durationSeconds}s`);
      const result = await runAutocannon({
        ...commonOptions,
        url: targetUrl,
        connections,
        duration: durationSeconds
      });
      const classified = classifyStage(result, thresholds);

      console.log(
        `  ${classified.passed ? "OK" : "FALHOU"} | ${formatNumber(classified.requestsPerSecond)} req/s | p95 ${formatNumber(classified.p95)} ms | erros ${formatNumber(classified.errorRate * 100)}%`
      );

      stages.push({
        route: route.path,
        name: route.name,
        connections,
        ...classified,
        result
      });
    }

    const safeStage = [...stages].reverse().find((stage) => stage.passed) ?? null;
    routeSummaries.push({
      ...route,
      stages,
      safeStage,
      warnings: detectWarnings(stages)
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    durationSeconds,
    warmupSeconds,
    timeoutSeconds,
    connectionStages,
    thresholds,
    routes: routeSummaries
  };

  const outputDir = path.join(process.cwd(), ".logs", "benchmarks");
  await mkdir(outputDir, { recursive: true });
  const stamp = summary.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `api-benchmark-${stamp}.json`);
  const mdPath = path.join(outputDir, `api-benchmark-${stamp}.md`);

  await writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(mdPath, buildMarkdownReport(summary), "utf8");

  console.log(`\nRelatorio JSON: ${jsonPath}`);
  console.log(`Relatorio Markdown: ${mdPath}`);
  console.log("\nResumo executivo:");

  for (const route of summary.routes) {
    if (!route.safeStage) {
      console.log(`- ${route.path}: nenhuma etapa segura encontrada`);
      continue;
    }

    console.log(
      `- ${route.path}: ate ${route.safeStage.connections} conexoes / ${route.safeStage.recommendedRps} req/s recomendados (p95 ${formatNumber(route.safeStage.p95)} ms)`
    );
  }

  const unsafeRoutes = summary.routes.filter((route) => !route.safeStage);
  if (unsafeRoutes.length > 0) {
    console.log(
      `\nAtencao: nenhuma etapa segura encontrada para ${unsafeRoutes
        .map((route) => route.path)
        .join(", ")}.`
    );
    process.exitCode = EXIT_CODE_UNSAFE;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
