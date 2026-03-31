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
- Benchmark de carga: `npm.cmd run benchmark:api -- --base-url https://seu-dominio --api-key SUA_API_KEY`

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
- Documentacao publica da API de estoque: `http://127.0.0.1:5173/docs/api-estoque`
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

Comandos principais do gerenciador:

- instalar:
  `sudo bash deploy/ubuntu/install.sh --action install --domain app.seudominio.com --email ops@seudominio.com --db-password 'senha-forte'`
- atualizar:
  `sudo bash deploy/ubuntu/install.sh --action update`
- trocar dominio e renovar SSL:
  `sudo bash deploy/ubuntu/install.sh --action change-domain --domain app-novo.seudominio.com --email ops@seudominio.com`

Se a porta `3000` da VPS ja estiver ocupada por outra aplicacao, use o instalador com `--app-port 3100` e o Nginx sera configurado automaticamente para essa porta.

Se o shell da VPS estiver com `NODE_ENV=production`, instale dependencias com `npm install --include=dev` no backend e no `frontend` para garantir `vite`, `typescript` e plugins de build.

## Benchmark de carga

O projeto inclui um benchmark real para medir:

- `GET /api/v1/products`
- `GET /api/v1/companyid`
- `GET /api/v1/my-inventory`

Critério padrao de etapa segura:

- `p95 <= 800ms`
- erro total `<= 1%`
- sem timeout
- sem respostas nao-2xx

Exemplo em PowerShell:

```powershell
$env:API_BASE_URL='https://estoque2.straviinsky.online'
$env:API_KEY='SUA_API_KEY'
npm.cmd run benchmark:api
```

Opcoes uteis:

- `--connections 5,10,25,50,100`
- `--duration 15`
- `--warmup 5`
- `--safe-p95-ms 800`
- `--safe-error-rate 0.01`

Relatorios gerados:

- JSON: `.logs/benchmarks/api-benchmark-<timestamp>.json`
- Markdown: `.logs/benchmarks/api-benchmark-<timestamp>.md`

Importante:

- use uma API key com limite alto o suficiente para o teste, senao o benchmark vai medir o rate limit em vez da capacidade real do backend
- rode preferencialmente na VPS ou em uma maquina proxima dela para reduzir distorcao de rede
