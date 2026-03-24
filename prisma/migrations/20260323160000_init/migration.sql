CREATE TABLE "companies" (
  "id" UUID PRIMARY KEY,
  "legal_name" TEXT NOT NULL,
  "external_code" TEXT NOT NULL UNIQUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "api_keys" (
  "id" UUID PRIMARY KEY,
  "company_id" UUID NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "key_prefix" VARCHAR(12) NOT NULL,
  "key_hash" VARCHAR(128) NOT NULL UNIQUE,
  "rate_limit_per_minute" INTEGER NOT NULL,
  "is_revoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "revoked_at" TIMESTAMPTZ NULL,
  "last_used_at" TIMESTAMPTZ NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_api_keys_company_id" ON "api_keys" ("company_id");
