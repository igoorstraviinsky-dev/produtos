import type {
  AdminInventoryItem,
  AdminInventoryResponse,
  ApiKeySummary,
  Company,
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.admin && ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {}),
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
  async updateCompany(companyId: string, payload: { legalName?: string; isActive?: boolean }) {
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
  async listInventoryProducts() {
    const response = await request<ApiEnvelope<Product[]>>("/admin/products", {
      admin: true
    });
    return response.data;
  },
  async updateInventoryProduct(
    productId: string,
    payload: { sku: string; name: string; availableQuantity: number }
  ) {
    const response = await request<ApiEnvelope<Product>>(`/admin/products/${productId}`, {
      method: "PATCH",
      admin: true,
      body: payload
    });
    return response.data;
  },
  getProducts(apiKey: string) {
    return request<ProductsResponse>("/api/v1/products", {
      apiKey
    });
  }
};
