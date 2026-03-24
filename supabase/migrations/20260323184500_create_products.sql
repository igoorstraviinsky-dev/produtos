CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  sku text NOT NULL,
  name text NOT NULL,
  available_quantity integer NOT NULL CHECK (available_quantity >= 0),
  price numeric(12, 2) NULL CHECK (price IS NULL OR price >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON public.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products (updated_at DESC);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
