import { SupabaseClient, createClient } from "@supabase/supabase-js";

export type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  availableQuantity: number;
  price: number | null;
  updatedAt: string | null;
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
  available_quantity?: number | null;
  stock_quantity?: number | null;
  price?: number | null;
  updated_at?: string | null;
};

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

    return ((data ?? []) as RemoteProductRow[]).map((row) => ({
      id: row.id,
      sku: row.sku ?? row.numero_serie ?? row.id,
      name: row.name ?? row.nome ?? row.id,
      availableQuantity: row.available_quantity ?? row.stock_quantity ?? 0,
      price: row.price ?? null,
      updatedAt: row.updated_at ?? null
    }));
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

    const row = data as RemoteProductRow;
    return {
      id: row.id,
      sku: row.sku ?? row.numero_serie ?? row.id,
      name: row.name ?? row.nome ?? row.id,
      availableQuantity: row.available_quantity ?? row.stock_quantity ?? 0,
      price: row.price ?? null,
      updatedAt: row.updated_at ?? null
    };
  }
}
