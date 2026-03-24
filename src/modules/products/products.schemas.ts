import { z } from "zod";

export const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  availableQuantity: z.number(),
  price: z.number().nullable(),
  updatedAt: z.string().nullable()
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
