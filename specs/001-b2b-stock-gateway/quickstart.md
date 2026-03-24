# Quickstart: B2B Stock Gateway

## 1. Environment variables

Create runtime configuration for:

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_KEY_PEPPER`
- `INTERNAL_WEBHOOK_SECRET`
- `PRODUCTS_CACHE_TTL_SECONDS`
- `PRODUCTS_CACHE_STALE_SECONDS`
- `WEBSOCKET_AUTH_TIMEOUT_MS`

## 2. Local services

Start:

- Local PostgreSQL for control-plane tables and tenant inventory
- Redis for cache and rate-limit counters
- The backend API service
- The React frontend

## 3. Database preparation

Run local migrations for:

- `companies`
- `api_keys`
- `master_products`
- `company_inventory`

Apply the remote Supabase catalog migration for `products`.

- Apply [20260323184500_create_products.sql](C:\Users\goohf\Desktop\parceiros\supabase\migrations\20260323184500_create_products.sql)
- Confirm `public.products` exists with the source columns used by the sync flow
- Keep RLS enabled so only the backend service role can read or update the master catalog

## 4. Seed an internal company and key

- Create one active company
- Issue one API key with a visible prefix and a per-minute limit
- Store only the deterministic hash and metadata locally

## 5. Synchronize the master catalog

1. Call `POST /api/internal/webhooks/supabase-sync` with `x-webhook-secret`.
2. Confirm local `master_products` was refreshed from Supabase.
3. Confirm connected partner dashboards receive `product_updated`.

## 6. Validate Meu Estoque

### Partner inventory fetch

1. Call `GET /api/v1/my-inventory` with a valid bearer token.
2. Confirm the response contains the master catalog plus the effective stock for that company.
3. Confirm a company with no custom row still sees `master_stock` as the initial effective value.

### Partner inventory update

1. Call `PUT /api/v1/my-inventory/:productId` with a new `customStockQuantity`.
2. Confirm only the authenticated company sees the new quantity on the next read.
3. Confirm another company still sees its own isolated quantity.

### Realtime catalog notice

1. Open the frontend at `http://127.0.0.1:5173/meu-estoque`.
2. Authenticate with a partner API key.
3. Trigger `POST /api/internal/webhooks/supabase-sync`.
4. Confirm the toast `O catalogo principal foi atualizado!` appears.
