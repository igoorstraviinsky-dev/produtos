CREATE TABLE "cost_settings_history" (
  "id" UUID NOT NULL,
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

  CONSTRAINT "cost_settings_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_cost_settings_history_created_at"
ON "cost_settings_history" ("created_at" DESC);
