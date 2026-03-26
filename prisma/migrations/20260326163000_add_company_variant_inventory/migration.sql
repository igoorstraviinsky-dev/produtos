CREATE TABLE "company_variant_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "variant_id" TEXT NOT NULL,
    "custom_stock_quantity" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "company_variant_inventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_company_variant_inventory_custom_stock_non_negative" CHECK ("custom_stock_quantity" >= 0)
);

CREATE UNIQUE INDEX "uq_company_variant_inventory_company_variant"
    ON "company_variant_inventory"("company_id", "variant_id");

CREATE INDEX "idx_company_variant_inventory_company_id"
    ON "company_variant_inventory"("company_id");

CREATE INDEX "idx_company_variant_inventory_variant_id"
    ON "company_variant_inventory"("variant_id");

ALTER TABLE "company_variant_inventory"
    ADD CONSTRAINT "company_variant_inventory_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_variant_inventory"
    ADD CONSTRAINT "company_variant_inventory_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
