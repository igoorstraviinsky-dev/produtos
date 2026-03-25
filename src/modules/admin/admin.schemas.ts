import { z } from "zod";

export const createCompanySchema = z.object({
  legalName: z.string().min(2),
  externalCode: z.string().min(2)
});

export const updateCompanyStatusSchema = z.object({
  isActive: z.boolean()
});

export const updateCompanySchema = z
  .object({
    legalName: z.string().min(2).optional(),
    isActive: z.boolean().optional()
  })
  .refine((payload) => payload.legalName !== undefined || payload.isActive !== undefined, {
    message: "At least one company field must be provided"
  });

export const issueApiKeySchema = z.object({
  companyId: z.string().uuid(),
  rateLimitPerMinute: z.number().int().positive()
});

export const updateAdminInventorySchema = z.object({
  customStockQuantity: z.number().int().nonnegative()
});

export const updateCostSettingsSchema = z
  .object({
    silverPricePerGram: z.number().nonnegative().optional(),
    zonaFrancaRatePercent: z.number().nonnegative().optional(),
    transportFee: z.number().nonnegative().optional(),
    dollarRate: z.number().positive().optional()
  })
  .refine(
    (payload) =>
      payload.silverPricePerGram !== undefined ||
      payload.zonaFrancaRatePercent !== undefined ||
      payload.transportFee !== undefined ||
      payload.dollarRate !== undefined,
    {
      message: "At least one cost setting must be provided"
    }
  );
