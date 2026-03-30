# Deploy em VPS Ubuntu 24.04

Este projeto pode rodar em uma VPS Ubuntu 24.04 usando:

- `systemd` para o backend Fastify
- `nginx` como reverse proxy e servidor do frontend estatico
- `certbot` para SSL automatico
- PostgreSQL e Redis locais

No fluxo atual de producao:

- o painel abre uma tela de login propria
- esse login usa um token unico definido em `ADMIN_TOKEN`
- o backend assina uma sessao administrativa para as chamadas seguintes

## O que o instalador faz

O script [install.sh](/C:/Users/goohf/Desktop/parceiros/deploy/ubuntu/install.sh):

- valida que a VPS usa Ubuntu 24.04
- instala dependencias de sistema
- instala Node.js 22
- garante PostgreSQL, Redis e Nginx ativos
- cria banco e usuario PostgreSQL local
- instala dependencias do backend e frontend
- gera os builds
- aplica migracoes do Prisma
- cria o service `produtos-api.service`
- publica o frontend no `nginx`
- prepara o painel para login por token administrativo
- valida DNS
- emite SSL via Let's Encrypt
- permite atualizar o projeto com `git pull`, rebuild e restart
- permite trocar o dominio e reemitir SSL sem reinstalar tudo

## Arquivos de producao

- backend: [.env.production.example](/C:/Users/goohf/Desktop/parceiros/.env.production.example)
- frontend: [frontend/.env.production.example](/C:/Users/goohf/Desktop/parceiros/frontend/.env.production.example)
- service: [produtos-api.service.template](/C:/Users/goohf/Desktop/parceiros/deploy/ubuntu/templates/produtos-api.service.template)
- nginx: [nginx-produtos.conf.template](/C:/Users/goohf/Desktop/parceiros/deploy/ubuntu/templates/nginx-produtos.conf.template)

## DNS antes do SSL

Antes de rodar o instalador, aponte um registro `A` do seu dominio para o IP publico da VPS.

Exemplo:

- `app.seudominio.com -> 203.0.113.10`

O instalador valida esse apontamento antes de chamar o `certbot`.

## Modos de uso

Sem parametros, o script abre um menu com:

1. `Instalar`
2. `Atualizar`
3. `Alterar dominio e SSL`

Tambem da para chamar diretamente por acao.

## Passo a passo

1. Clone o repositório na VPS.
2. Copie `.env.production.example` para `.env.production`.
3. Preencha pelo menos:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - opcionalmente `ADMIN_TOKEN` e `ADMIN_SESSION_SECRET`
     Se deixar com o placeholder, o instalador gera os dois automaticamente.
4. Rode:

```bash
sudo bash deploy/ubuntu/install.sh --action install \
  --domain app.seudominio.com \
  --email ops@seudominio.com \
  --app-port 3000 \
  --db-password 'uma-senha-forte-para-o-postgres'
```

Se a sua VPS ja tiver outra aplicacao ocupando a `3000`, rode em outra porta:

```bash
sudo bash deploy/ubuntu/install.sh --action install \
  --domain app.seudominio.com \
  --email ops@seudominio.com \
  --app-port 3100 \
  --db-password 'uma-senha-forte-para-o-postgres'
```

## Atualizacao de codigo na VPS

Para atualizar o projeto existente:

```bash
cd /opt/produtos
sudo bash deploy/ubuntu/install.sh --action update
```

Esse fluxo:

- roda `git pull --ff-only origin main`
- reinstala dependencias
- gera os builds
- aplica migracoes
- reinicia o `produtos-api`
- recarrega o `nginx`

## Alteracao de dominio com HTTPS

Para trocar o dominio do projeto e gerar SSL automaticamente:

```bash
cd /opt/produtos
sudo bash deploy/ubuntu/install.sh --action change-domain \
  --domain app-novo.seudominio.com \
  --email ops@seudominio.com
```

Esse fluxo:

- atualiza `PUBLIC_BASE_URL` no `.env.production`
- reescreve o `nginx` com o novo dominio
- desabilita sites antigos conflitantes no `sites-enabled`
- valida se o DNS novo ja aponta para a VPS
- chama o `certbot`
- deixa o novo dominio pronto em `https://`

## Rotas e protecao

- `/api/v1/*`: publico para os clientes B2B
- `/api/internal/webhooks/*`: liberado, protegido pelo `INTERNAL_WEBHOOK_SECRET`
- `/admin/*`: protegido pela sessao criada na tela de login do painel
- `/api/internal/admin/*`: protegido pela sessao criada na tela de login do painel
- `/`: frontend admin servido sem popup de navegador

## Como entrar no painel

1. acesse `https://seu-dominio/`
2. a propria aplicacao vai exibir a tela de login do painel
3. use o token salvo em `ADMIN_TOKEN`

Esse token pode ser o que voce preencheu em `.env.production` ou o gerado automaticamente pelo instalador.

## Operacao

Comandos uteis:

```bash
cd /opt/produtos && npm install --include=dev
cd /opt/produtos/frontend && npm install --include=dev
sudo systemctl status produtos-api
sudo journalctl -u produtos-api -n 200 --no-pager
sudo nginx -t
sudo systemctl reload nginx
```

## Observacoes importantes

- O painel admin atual e servido como frontend estatico.
- O `VITE_ADMIN_TOKEN` nao precisa ser embutido no frontend de producao.
- O backend continua validando `ADMIN_TOKEN` para criar a sessao do painel.
- O backend continua ouvindo em `127.0.0.1:3000`, e o acesso externo deve passar pelo `nginx`.
- Se a VPS estiver com `NODE_ENV=production` no shell, use `npm install --include=dev` no backend e no frontend para nao perder `vite`, `typescript` e plugins de build.
