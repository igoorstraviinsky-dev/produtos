CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "individual_weight" DOUBLE PRECISION,
    "individual_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_product_variants_product_id" ON "product_variants"("product_id");

ALTER TABLE "product_variants"
ADD CONSTRAINT "product_variants_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "master_products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
