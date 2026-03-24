export type Company = {
  id: string;
  legalName: string;
  externalCode: string;
  isActive: boolean;
  apiKeyCount: number;
  activeKeyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeySummary = {
  id: string;
  companyId: string;
  keyPrefix: string;
  rateLimitPerMinute: number;
  isRevoked: boolean;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type IssuedApiKey = {
  apiKeyId: string;
  companyId: string;
  keyPrefix: string;
  plaintextKey: string;
  rateLimitPerMinute: number;
  isRevoked: boolean;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  availableQuantity: number;
  price: number | null;
  updatedAt: string | null;
};

export type ProductsResponse = {
  data: Product[];
  meta: {
    source: "cache" | "upstream";
    count: number;
    stale?: boolean;
  };
};

export type HealthResponse = {
  status: "ok";
};

export type AdminInventoryItem = {
  productId: string;
  sku: string;
  name: string;
  masterStock: number;
  customStockQuantity: number | null;
  effectiveStockQuantity: number;
  updatedAt: string;
};

export type AdminInventoryResponse = {
  data: AdminInventoryItem[];
  meta: {
    count: number;
    companyId: string;
    companyName: string;
  };
};

export type PartnerInventoryItem = AdminInventoryItem;

export type MyInventoryResponse = AdminInventoryResponse;
