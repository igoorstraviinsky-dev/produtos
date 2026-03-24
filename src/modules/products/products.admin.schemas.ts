import { z } from "zod";

export const updateInventoryProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  availableQuantity: z.number().int().nonnegative()
});
