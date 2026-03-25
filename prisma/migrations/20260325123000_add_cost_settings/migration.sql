CREATE TABLE "cost_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "silver_price_per_gram" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "zona_franca_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 6,
  "transport_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  "dollar_rate" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cost_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "cost_settings" (
  "id",
  "silver_price_per_gram",
  "zona_franca_rate_percent",
  "transport_fee",
  "dollar_rate"
)
VALUES ('default', 1, 6, 0.1, 5)
ON CONFLICT ("id") DO NOTHING;
