CREATE TABLE IF NOT EXISTS public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku text NOT NULL,
    individual_weight numeric(10, 3),
    individual_stock integer NOT NULL DEFAULT 0 CHECK (individual_stock >= 0),
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
    ON public.product_variants(product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_product_sku
    ON public.product_variants(product_id, sku);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
