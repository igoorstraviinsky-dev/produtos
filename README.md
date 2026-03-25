# B2B Stock Gateway

API Gateway de Estoque B2B com autenticacao zero trust, controle administrativo em
PostgreSQL local, cache e rate limiting em Redis, catalogo mestre sincronizado do
Supabase e estoque isolado por parceiro.

## Requisitos

- Node.js 22+
- PostgreSQL
- Redis
- Credenciais validas do Supabase

## Setup

1. Ajuste as variaveis a partir de [.env.example](C:\Users\goohf\Desktop\parceiros\.env.example).
2. Instale dependencias com `npm.cmd install`.
3. Gere o client do Prisma com `npm.cmd run prisma:generate`.
4. Aplique migracoes locais com `npm.cmd run prisma:migrate:dev`.
5. Aplique a migration remota do catalogo no Supabase usando [20260323184500_create_products.sql](C:\Users\goohf\Desktop\parceiros\supabase\migrations\20260323184500_create_products.sql).
6. Configure `INTERNAL_WEBHOOK_SECRET` para autenticar `POST /api/internal/webhooks/supabase-sync`.

## Execucao

- Backend em desenvolvimento: `npm.cmd run dev`
- Frontend em desenvolvimento: `cd frontend && npm.cmd run dev -- --host 127.0.0.1 --port 5173`
- Build: `npm.cmd run build`
- Testes: `npm.cmd run test`

## Endpoints principais

- `GET /api/v1/products`
- `GET /api/v1/my-inventory`
- `PATCH /api/v1/my-inventory/:productId`
- `POST /api/internal/webhooks/supabase-sync`
- `GET /admin/companies`
- `POST /admin/companies`
- `DELETE /api/internal/admin/companies/:companyId`
- `PATCH /admin/companies/:companyId/status`
- `POST /admin/api-keys`
- `PATCH /admin/api-keys/:apiKeyId/revoke`
- `POST /api/internal/admin/session/login`

## Frontend

- Painel admin: `http://127.0.0.1:5173/`
- Catalogo mestre: `http://127.0.0.1:5173/produtos`
- Meu Estoque: `http://127.0.0.1:5173/meu-estoque`

O painel admin agora usa tela de login com token administrativo unico.

## Deploy em VPS

Existe uma estrutura pronta para Ubuntu 24.04 com:

- `systemd`
- `nginx`
- `certbot`
- PostgreSQL e Redis locais
- instalador idempotente com verificacao de dependencias

Arquivos principais:

- [install.sh](C:\Users\goohf\Desktop\parceiros\deploy\ubuntu\install.sh)
- [deploy-ubuntu-24.04.md](C:\Users\goohf\Desktop\parceiros\docs\deploy-ubuntu-24.04.md)

Fluxo resumido:

1. configure o DNS para apontar para a VPS
2. preencha [`.env.production.example`](C:\Users\goohf\Desktop\parceiros\.env.production.example)
3. rode o instalador com dominio, email e senha do PostgreSQL
4. entre no painel com o token salvo em `ADMIN_TOKEN`
