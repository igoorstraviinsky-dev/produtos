import { z } from "zod";

export const productCostBreakdownSchema = z.object({
  laborCostUsd: z.number(),
  laborCostBrl: z.number(),
  silverCost: z.number(),
  r1: z.number(),
  r2: z.number(),
  r3: z.number(),
  finalCost: z.number()
});

export const productVariantOptionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string()
});

export const productVariantSchema = z.object({
  variant_id: z.string(),
  variantId: z.string(),
  product_id: z.string(),
  productId: z.string(),
  sku: z.string(),
  individual_weight: z.union([z.string(), z.number()]).nullable(),
  individualWeight: z.union([z.string(), z.number()]).nullable(),
  individual_stock: z.number(),
  individualStock: z.number(),
  size_labels: z.array(z.string()),
  sizeLabels: z.array(z.string()),
  color_labels: z.array(z.string()),
  colorLabels: z.array(z.string()),
  options: z.array(productVariantOptionSchema),
  created_at: z.string().nullable(),
  createdAt: z.string().nullable(),
  updated_at: z.string().nullable(),
  updatedAt: z.string().nullable()
});

export const productSchema = z.object({
  variants: z.array(productVariantSchema),
  id: z.string(),
  product_id: z.string(),
  code: z.string(),
  sku: z.string(),
  numero_serie: z.string(),
  name: z.string(),
  nome: z.string(),
  serialNumber: z.string(),
  description: z.string().nullable(),
  descricao: z.string().nullable(),
  category: z.string().nullable(),
  categoria: z.string().nullable(),
  subcategory: z.string().nullable(),
  subcategoria: z.string().nullable(),
  material: z.string().nullable(),
  baseMaterial: z.string().nullable(),
  material_base: z.string().nullable(),
  purity: z.string().nullable(),
  pureza: z.string().nullable(),
  weight_grams: z.union([z.string(), z.number()]).nullable(),
  weightGrams: z.union([z.string(), z.number()]).nullable(),
  peso_gramas: z.union([z.string(), z.number()]).nullable(),
  bathType: z.string().nullable(),
  tipo_banho: z.string().nullable(),
  status: z.string().nullable(),
  bronzeImageKey: z.string().nullable(),
  s3_key_bronze: z.string().nullable(),
  silverImageKey: z.string().nullable(),
  s3_key_silver: z.string().nullable(),
  supplierCode: z.string().nullable(),
  supplier_code: z.string().nullable(),
  fiscalCode: z.string().nullable(),
  fiscal_code: z.string().nullable(),
  categoryId: z.string().nullable(),
  category_id: z.string().nullable(),
  productType: z.string().nullable(),
  tipo: z.string().nullable(),
  typeId: z.string().nullable(),
  type_id: z.string().nullable(),
  subcategoryId: z.string().nullable(),
  subcategory_id: z.string().nullable(),
  blingProductId: z.string().nullable(),
  bling_product_id: z.string().nullable(),
  blingLastSyncAt: z.string().nullable(),
  bling_last_sync_at: z.string().nullable(),
  laborRateId: z.string().nullable(),
  labor_rate_id: z.string().nullable(),
  laborRateLabel: z.string().nullable(),
  labor_rate_label: z.string().nullable(),
  laborCost: z.union([z.string(), z.number()]).nullable(),
  labor_cost: z.union([z.string(), z.number()]).nullable(),
  sizeOptionId: z.string().nullable(),
  size_option_id: z.string().nullable(),
  sizeLabel: z.string().nullable(),
  size_label: z.string().nullable(),
  colorOptionId: z.string().nullable(),
  color_option_id: z.string().nullable(),
  colorLabel: z.string().nullable(),
  color_label: z.string().nullable(),
  availableQuantity: z.number(),
  available_quantity: z.number().nullable(),
  stock_quantity: z.number().nullable(),
  ncm: z.string().nullable(),
  laborRateTableId: z.string().nullable(),
  labor_rate_table_id: z.string().nullable(),
  laborRateTableName: z.string().nullable(),
  labor_rate_table_name: z.string().nullable(),
  createdAt: z.string().nullable(),
  created_at: z.string().nullable(),
  price: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updated_at: z.string().nullable(),
  costFinal: z.number(),
  costBreakdown: productCostBreakdownSchema
});

export const productsResponseSchema = z.object({
  data: z.array(productSchema),
  meta: z.object({
    source: z.enum(["cache", "upstream"]),
    stale: z.boolean().optional(),
    count: z.number().int().nonnegative()
  })
});

export type ProductsResponse = z.infer<typeof productsResponseSchema>;
