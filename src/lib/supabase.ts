import { SupabaseClient, createClient } from "@supabase/supabase-js";

export type ProductRecord = {
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
};

export interface ProductGateway {
  listProducts(): Promise<ProductRecord[]>;
  updateProduct(input: {
    id: string;
    sku: string;
    name: string;
    availableQuantity: number;
  }): Promise<ProductRecord>;
}

type RemoteProductRow = {
  id: string;
  sku?: string | null;
  numero_serie?: string | null;
  name?: string | null;
  nome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  material_base?: string | null;
  pureza?: string | null;
  peso_gramas?: string | null;
  tipo_banho?: string | null;
  status?: string | null;
  s3_key_bronze?: string | null;
  s3_key_silver?: string | null;
  supplier_code?: string | null;
  fiscal_code?: string | null;
  category_id?: string | null;
  tipo?: string | null;
  type_id?: string | null;
  subcategory_id?: string | null;
  bling_product_id?: string | null;
  bling_last_sync_at?: string | null;
  labor_rate_id?: string | null;
  labor_rate_label?: string | null;
  labor_cost?: string | number | null;
  size_option_id?: string | null;
  size_label?: string | null;
  color_option_id?: string | null;
  color_label?: string | null;
  available_quantity?: number | null;
  stock_quantity?: number | null;
  ncm?: string | null;
  labor_rate_table_id?: string | null;
  labor_rate_table_name?: string | null;
  created_at?: string | null;
  price?: number | null;
  updated_at?: string | null;
};

function mapRemoteProductRow(row: RemoteProductRow): ProductRecord {
  return {
    id: row.id,
    sku: row.sku ?? row.numero_serie ?? row.id,
    numero_serie: row.numero_serie ?? row.sku ?? row.id,
    name: row.name ?? row.nome ?? row.id,
    nome: row.nome ?? row.name ?? row.id,
    serialNumber: row.numero_serie ?? row.sku ?? row.id,
    description: row.descricao ?? null,
    descricao: row.descricao ?? null,
    category: row.categoria ?? null,
    categoria: row.categoria ?? null,
    subcategory: row.subcategoria ?? null,
    subcategoria: row.subcategoria ?? null,
    baseMaterial: row.material_base ?? null,
    material_base: row.material_base ?? null,
    purity: row.pureza ?? null,
    pureza: row.pureza ?? null,
    weightGrams: row.peso_gramas ?? null,
    peso_gramas: row.peso_gramas ?? null,
    bathType: row.tipo_banho ?? null,
    tipo_banho: row.tipo_banho ?? null,
    status: row.status ?? null,
    bronzeImageKey: row.s3_key_bronze ?? null,
    s3_key_bronze: row.s3_key_bronze ?? null,
    silverImageKey: row.s3_key_silver ?? null,
    s3_key_silver: row.s3_key_silver ?? null,
    supplierCode: row.supplier_code ?? null,
    supplier_code: row.supplier_code ?? null,
    fiscalCode: row.fiscal_code ?? null,
    fiscal_code: row.fiscal_code ?? null,
    categoryId: row.category_id ?? null,
    category_id: row.category_id ?? null,
    productType: row.tipo ?? null,
    tipo: row.tipo ?? null,
    typeId: row.type_id ?? null,
    type_id: row.type_id ?? null,
    subcategoryId: row.subcategory_id ?? null,
    subcategory_id: row.subcategory_id ?? null,
    blingProductId: row.bling_product_id ?? null,
    bling_product_id: row.bling_product_id ?? null,
    blingLastSyncAt: row.bling_last_sync_at ?? null,
    bling_last_sync_at: row.bling_last_sync_at ?? null,
    laborRateId: row.labor_rate_id ?? null,
    labor_rate_id: row.labor_rate_id ?? null,
    laborRateLabel: row.labor_rate_label ?? null,
    labor_rate_label: row.labor_rate_label ?? null,
    laborCost:
      row.labor_cost === null || row.labor_cost === undefined ? null : String(row.labor_cost),
    labor_cost:
      row.labor_cost === null || row.labor_cost === undefined ? null : row.labor_cost,
    sizeOptionId: row.size_option_id ?? null,
    size_option_id: row.size_option_id ?? null,
    sizeLabel: row.size_label ?? null,
    size_label: row.size_label ?? null,
    colorOptionId: row.color_option_id ?? null,
    color_option_id: row.color_option_id ?? null,
    colorLabel: row.color_label ?? null,
    color_label: row.color_label ?? null,
    availableQuantity: row.available_quantity ?? row.stock_quantity ?? 0,
    available_quantity: row.available_quantity ?? null,
    stock_quantity: row.stock_quantity ?? null,
    ncm: row.ncm ?? null,
    laborRateTableId: row.labor_rate_table_id ?? null,
    labor_rate_table_id: row.labor_rate_table_id ?? null,
    laborRateTableName: row.labor_rate_table_name ?? null,
    labor_rate_table_name: row.labor_rate_table_name ?? null,
    createdAt: row.created_at ?? null,
    created_at: row.created_at ?? null,
    price: row.price ?? null,
    updatedAt: row.updated_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

export function createSupabaseGatewayClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export class SupabaseProductGateway implements ProductGateway {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tableName: string
  ) {}

  async listProducts() {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*");

    if (error) {
      throw new Error(`supabase products query failed: ${error.message}`);
    }

    return ((data ?? []) as RemoteProductRow[]).map(mapRemoteProductRow);
  }

  async updateProduct(input: {
    id: string;
    sku: string;
    name: string;
    availableQuantity: number;
  }) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({
        numero_serie: input.sku,
        nome: input.name,
        stock_quantity: input.availableQuantity,
        updated_at: new Date().toISOString()
      })
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`supabase product update failed: ${error.message}`);
    }

    return mapRemoteProductRow(data as RemoteProductRow);
  }
}
