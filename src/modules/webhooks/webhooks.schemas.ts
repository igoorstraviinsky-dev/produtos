import { z } from "zod";

export const supabaseSyncWebhookSchema = z
  .object({
    type: z.string().optional(),
    table: z.string().optional(),
    schema: z.string().optional(),
    record: z.record(z.unknown()).optional(),
    old_record: z.record(z.unknown()).optional()
  })
  .passthrough();
