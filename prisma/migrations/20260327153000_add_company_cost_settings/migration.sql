CREATE TABLE "company_cost_settings" (
  "company_id" UUID PRIMARY KEY,
  "silver_price_per_gram" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "zona_franca_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 6,
  "transport_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  "dollar_rate" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_company_cost_settings_company_id"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "company_cost_settings_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "previous_silver_price_per_gram" DOUBLE PRECISION NOT NULL,
  "next_silver_price_per_gram" DOUBLE PRECISION NOT NULL,
  "previous_zona_franca_rate_percent" DOUBLE PRECISION NOT NULL,
  "next_zona_franca_rate_percent" DOUBLE PRECISION NOT NULL,
  "previous_transport_fee" DOUBLE PRECISION NOT NULL,
  "next_transport_fee" DOUBLE PRECISION NOT NULL,
  "previous_dollar_rate" DOUBLE PRECISION NOT NULL,
  "next_dollar_rate" DOUBLE PRECISION NOT NULL,
  "changed_fields" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_company_cost_settings_history_company_id"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_company_cost_settings_history_company_id"
  ON "company_cost_settings_history"("company_id");
