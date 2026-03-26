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
  media_assets: ProductMediaAsset[];
  mediaAssets: ProductMediaAsset[];
  media_urls: string[];
  mediaUrls: string[];
  main_image_url: string | null;
  mainImageUrl: string | null;
  variants: ProductVariant[];
  id: string;
  product_id: string;
  code: string;
  sku: string;
  numero_serie: string;
  name: string;
  nome: string;
  serialNumber: string;
  description: string | null;
  descricao: string | null;
  category: string | null;
  categoria: string | null;
  subcategory: string | null;
  subcategoria: string | null;
  material: string | null;
  baseMaterial: string | null;
  material_base: string | null;
  purity: string | null;
  pureza: string | null;
  weight_grams: string | number | null;
  weightGrams: string | number | null;
  peso_gramas: string | number | null;
  bathType: string | null;
  tipo_banho: string | null;
  status: string | null;
  bronzeImageKey: string | null;
  s3_key_bronze: string | null;
  silverImageKey: string | null;
  s3_key_silver: string | null;
  supplierCode: string | null;
  supplier_code: string | null;
  fiscalCode: string | null;
  fiscal_code: string | null;
  categoryId: string | null;
  category_id: string | null;
  productType: string | null;
  tipo: string | null;
  typeId: string | null;
  type_id: string | null;
  subcategoryId: string | null;
  subcategory_id: string | null;
  blingProductId: string | null;
  bling_product_id: string | null;
  blingLastSyncAt: string | null;
  bling_last_sync_at: string | null;
  laborRateId: string | null;
  labor_rate_id: string | null;
  laborRateLabel: string | null;
  labor_rate_label: string | null;
  laborCost: string | number | null;
  labor_cost: string | number | null;
  sizeOptionId: string | null;
  size_option_id: string | null;
  sizeLabel: string | null;
  size_label: string | null;
  colorOptionId: string | null;
  color_option_id: string | null;
  colorLabel: string | null;
  color_label: string | null;
  availableQuantity: number;
  available_quantity: number | null;
  stock_quantity: number | null;
  ncm: string | null;
  laborRateTableId: string | null;
  labor_rate_table_id: string | null;
  laborRateTableName: string | null;
  labor_rate_table_name: string | null;
  createdAt: string | null;
  created_at: string | null;
  price: number | null;
  updatedAt: string | null;
  updated_at: string | null;
  costFinal: number;
  costBreakdown: {
    laborCostUsd: number;
    laborCostBrl: number;
    silverCost: number;
    r1: number;
    r2: number;
    r3: number;
    finalCost: number;
  };
};

export type ProductMediaAsset = {
  id: string;
  role: string;
  storage_key: string;
  storageKey: string;
  sort_order: number;
  sortOrder: number;
  url: string | null;
  created_at: string | null;
  createdAt: string | null;
};

export type ProductVariant = {
  variant_id: string;
  variantId: string;
  product_id: string;
  productId: string;
  sku: string;
  individual_weight: string | number | null;
  individualWeight: string | number | null;
  individual_stock: number;
  individualStock: number;
  size_labels: string[];
  sizeLabels: string[];
  color_labels: string[];
  colorLabels: string[];
  options: Array<{
    id: string;
    kind: string;
    label: string;
  }>;
  created_at: string | null;
  createdAt: string | null;
  updated_at: string | null;
  updatedAt: string | null;
};

export type CostSettings = {
  silverPricePerGram: number;
  zonaFrancaRatePercent: number;
  transportFee: number;
  dollarRate: number;
  updatedAt: string;
};

export type CostSettingsHistoryEntry = {
  id: string;
  changedFields: string[];
  previous: {
    silverPricePerGram: number;
    zonaFrancaRatePercent: number;
    transportFee: number;
    dollarRate: number;
  };
  next: {
    silverPricePerGram: number;
    zonaFrancaRatePercent: number;
    transportFee: number;
    dollarRate: number;
  };
  createdAt: string;
};

export type AdminLoginMode = "credentials" | "token" | "open";

export type AdminSessionConfig = {
  requiresAuth: boolean;
  loginMode: AdminLoginMode;
  usernameHint: string | null;
  sessionTtlSeconds: number;
};

export type AdminSession = {
  token: string | null;
  expiresAt: string | null;
  admin: {
    username: string;
    displayName: string;
    loginMode: AdminLoginMode;
  };
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
