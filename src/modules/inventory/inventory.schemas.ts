import { z } from "zod";

export const updateMyInventorySchema = z.object({
  custom_stock_quantity: z.number().int().nonnegative()
});

const syncMyInventoryItemInputSchema = z
  .object({
    product_id: z.string().trim().min(1).optional(),
    productId: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    numero_serie: z.string().trim().min(1).optional(),
    numeroSerie: z.string().trim().min(1).optional(),
    custom_stock_quantity: z.number().int().nonnegative().optional(),
    customStockQuantity: z.number().int().nonnegative().optional()
  })
  .refine(
    (value) =>
      Boolean(
        value.product_id ??
          value.productId ??
          value.sku ??
          value.code ??
          value.numero_serie ??
          value.numeroSerie
      ),
    {
      message:
        "Each item must include product_id, productId, sku, code, numero_serie, or numeroSerie",
      path: ["product_id"]
    }
  )
  .refine(
    (value) =>
      value.custom_stock_quantity !== undefined || value.customStockQuantity !== undefined,
    {
      message: "Each item must include custom_stock_quantity or customStockQuantity",
      path: ["custom_stock_quantity"]
    }
  );

export const syncMyInventorySchema = z
  .object({
    items: z.array(syncMyInventoryItemInputSchema).min(1)
  })
  .transform(({ items }) => ({
    items: items.map((item) => ({
      productId: item.product_id ?? item.productId ?? null,
      sku: item.sku ?? null,
      code: item.code ?? null,
      numeroSerie: item.numero_serie ?? item.numeroSerie ?? null,
      customStockQuantity: item.custom_stock_quantity ?? item.customStockQuantity ?? 0
    }))
  }));

export type MyInventoryItem = {
  productId: string;
  sku: string;
  name: string;
  masterStock: number;
  customStockQuantity: number | null;
  effectiveStockQuantity: number;
  updatedAt: string;
};

export type MyInventoryResponse = {
  data: MyInventoryItem[];
  meta: {
    count: number;
    companyId: string;
  };
};

export type SyncMyInventoryInput = z.infer<typeof syncMyInventorySchema>;

export type SyncMyInventoryItem = SyncMyInventoryInput["items"][number];

export type MyInventorySyncError = {
  index: number;
  productId: string | null;
  sku: string | null;
  code: string | null;
  numeroSerie: string | null;
  message: string;
};

export type MyInventorySyncResponse = {
  data: MyInventoryItem[];
  errors: MyInventorySyncError[];
  meta: {
    companyId: string;
    receivedCount: number;
    updatedCount: number;
    errorCount: number;
  };
};
