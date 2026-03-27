import type {
  AdminSession,
  AdminSessionConfig,
  AdminInventoryItem,
  AdminInventoryResponse,
  ApiKeySummary,
  Company,
  CostSettings,
  CostSettingsHistoryEntry,
  HealthResponse,
  IssuedApiKey,
  Product,
  ProductsResponse
} from "../types";

type RequestOptions = {
  method?: string;
  body?: unknown;
  admin?: boolean;
  apiKey?: string;
};

type ApiEnvelope<T> = {
  data: T;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? "";
const ADMIN_SESSION_STORAGE_KEY = "parceiros.admin.session";

function getStoredAdminSessionToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ?? "";
}

function setStoredAdminSessionToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token);
}

function clearStoredAdminSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const adminSessionToken = options.admin ? getStoredAdminSessionToken() : "";

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.admin && adminSessionToken
        ? { authorization: `Bearer ${adminSessionToken}` }
        : {}),
      ...(options.admin && !adminSessionToken && ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {}),
      ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const rawBody = await response.text();
  const parsedBody = rawBody ? (JSON.parse(rawBody) as T | ApiErrorPayload) : null;

  if (!response.ok) {
    const errorPayload = parsedBody as ApiErrorPayload | null;
    throw new ApiError(
      errorPayload?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorPayload?.error
    );
  }

  return parsedBody as T;
}

export const api = {
  hasStoredAdminSession() {
    return Boolean(getStoredAdminSessionToken());
  },
  clearAdminSession() {
    clearStoredAdminSessionToken();
  },
  async getAdminSessionConfig() {
    const response = await request<ApiEnvelope<AdminSessionConfig>>(
      "/api/internal/admin/session/config"
    );
    return response.data;
  },
  async loginAdmin(payload: { username?: string; password: string }) {
    const response = await request<ApiEnvelope<AdminSession>>("/api/internal/admin/session/login", {
      method: "POST",
      body: payload
    });

    if (response.data.token) {
      setStoredAdminSessionToken(response.data.token);
    } else {
      clearStoredAdminSessionToken();
    }

    return response.data;
  },
  async getAdminSession() {
    const response = await request<ApiEnvelope<AdminSession>>("/api/internal/admin/session/me", {
      admin: true
    });
    return response.data;
  },
  getHealth() {
    return request<HealthResponse>("/health");
  },
  async listCompanies() {
    const response = await request<ApiEnvelope<Company[]>>("/api/internal/admin/companies", {
      admin: true
    });
    return response.data;
  },
  async createCompany(payload: { legalName: string; externalCode: string }) {
    const response = await request<ApiEnvelope<Company>>("/api/internal/admin/companies", {
      method: "POST",
      admin: true,
      body: payload
    });
    return response.data;
  },
  async updateCompany(
    companyId: string,
    payload: { legalName?: string; isActive?: boolean; syncStoreInventory?: boolean }
  ) {
    const response = await request<ApiEnvelope<Company>>(
      `/api/internal/admin/companies/${companyId}`,
      {
        method: "PATCH",
        admin: true,
        body: payload
      }
    );
    return response.data;
  },
  async deleteCompany(companyId: string) {
    const response = await request<ApiEnvelope<Company>>(
      `/api/internal/admin/companies/${companyId}`,
      {
        method: "DELETE",
        admin: true
      }
    );
    return response.data;
  },
  async listCompanyApiKeys(companyId: string) {
    const response = await request<ApiEnvelope<ApiKeySummary[]>>(
      `/api/internal/admin/companies/${companyId}/api-keys`,
      {
        admin: true
      }
    );
    return response.data;
  },
  async issueApiKey(companyId: string, rateLimitPerMinute: number) {
    const response = await request<ApiEnvelope<IssuedApiKey>>("/api/internal/admin/api-keys", {
      method: "POST",
      admin: true,
      body: {
        companyId,
        rateLimitPerMinute
      }
    });
    return response.data;
  },
  async revokeApiKey(apiKeyId: string) {
    const response = await request<ApiEnvelope<ApiKeySummary>>(
      `/api/internal/admin/api-keys/${apiKeyId}/revoke`,
      {
        method: "PATCH",
        admin: true
      }
    );
    return response.data;
  },
  async listCompanyInventory(companyId: string) {
    return request<AdminInventoryResponse>(
      `/api/internal/admin/companies/${companyId}/inventory`,
      {
        admin: true
      }
    );
  },
  async updateCompanyInventory(
    companyId: string,
    productId: string,
    payload: { customStockQuantity: number }
  ) {
    const response = await request<{ data: AdminInventoryItem }>(
      `/api/internal/admin/companies/${companyId}/inventory/${productId}`,
      {
        method: "PUT",
        admin: true,
        body: payload
      }
    );
    return response.data;
  },
  async listInventoryProducts(companyId?: string) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    const response = await request<ApiEnvelope<Product[]>>(`/api/internal/admin/products${query}`, {
      admin: true
    });
    return response.data;
  },
  async syncMasterCatalog() {
    const response = await request<ApiEnvelope<{ syncedCount: number; updatedAt: string }>>(
      "/api/internal/admin/products/sync",
      {
        method: "POST",
        admin: true
      }
    );
    return response.data;
  },
  async getCostSettings(companyId?: string) {
    const path = companyId
      ? `/api/internal/admin/companies/${companyId}/cost-settings`
      : "/api/internal/admin/cost-settings";
    const response = await request<ApiEnvelope<CostSettings>>(path, { admin: true });
    return response.data;
  },
  async updateCostSettings(
    payload: Partial<Omit<CostSettings, "updatedAt" | "companyId">>,
    companyId?: string
  ) {
    const path = companyId
      ? `/api/internal/admin/companies/${companyId}/cost-settings`
      : "/api/internal/admin/cost-settings";
    const response = await request<ApiEnvelope<CostSettings>>(path, {
      method: "PATCH",
      admin: true,
      body: payload
    });
    return response.data;
  },
  async listCostSettingsHistory(companyId?: string) {
    const path = companyId
      ? `/api/internal/admin/companies/${companyId}/cost-settings/history`
      : "/api/internal/admin/cost-settings/history";
    const response = await request<ApiEnvelope<CostSettingsHistoryEntry[]>>(path, {
      admin: true
    });
    return response.data;
  },
  async updateInventoryProduct(
    productId: string,
    payload: { sku: string; name: string; availableQuantity: number }
  ) {
    const response = await request<ApiEnvelope<Product>>(
      `/api/internal/admin/products/${productId}`,
      {
        method: "PATCH",
        admin: true,
        body: payload
      }
    );
    return response.data;
  },
  getProducts(apiKey: string) {
    return request<ProductsResponse>("/api/v1/products", {
      apiKey
    });
  }
};
