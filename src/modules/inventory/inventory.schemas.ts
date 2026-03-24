import { z } from "zod";

export const updateMyInventorySchema = z.object({
  customStockQuantity: z.number().int().nonnegative()
});

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
