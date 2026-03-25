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
  baseMaterial: string | null;
  material_base: string | null;
  purity: string | null;
  pureza: string | null;
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
