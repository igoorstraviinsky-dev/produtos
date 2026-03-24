CREATE TABLE "master_products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "master_stock" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "master_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "product_id" TEXT NOT NULL,
    "custom_stock_quantity" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "company_inventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_company_inventory_custom_stock_non_negative" CHECK ("custom_stock_quantity" >= 0)
);

CREATE UNIQUE INDEX "uq_company_inventory_company_product"
    ON "company_inventory"("company_id", "product_id");

CREATE INDEX "idx_company_inventory_company_id"
    ON "company_inventory"("company_id");

CREATE INDEX "idx_company_inventory_product_id"
    ON "company_inventory"("product_id");

ALTER TABLE "company_inventory"
    ADD CONSTRAINT "company_inventory_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_inventory"
    ADD CONSTRAINT "company_inventory_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "master_products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
