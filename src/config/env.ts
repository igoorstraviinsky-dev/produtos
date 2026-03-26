import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PUBLIC_BASE_URL: z.string().url().optional().transform((value) => value?.replace(/\/+$/, "")),
  LOCAL_MEDIA_ROOT: z.string().optional().transform((value) => value?.trim() || undefined),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PRODUCTS_TABLE: z.string().min(1).default("products"),
  API_KEY_PEPPER: z.string().min(16),
  INTERNAL_WEBHOOK_SECRET: z.string().min(16).default("local-supabase-sync-secret"),
  PRODUCTS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  PRODUCTS_CACHE_STALE_SECONDS: z.coerce.number().int().nonnegative().default(300),
  WEBSOCKET_AUTH_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  ADMIN_TOKEN: z.string().optional().transform((value) => value?.trim() || undefined),
  ADMIN_USERNAME: z.string().optional().transform((value) => value?.trim() || undefined),
  ADMIN_PASSWORD: z.string().optional().transform((value) => value?.trim() || undefined),
  ADMIN_SESSION_SECRET: z.string().optional().transform((value) => value?.trim() || undefined)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
