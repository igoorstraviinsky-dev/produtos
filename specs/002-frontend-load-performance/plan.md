# Implementation Plan: Frontend Load Performance Upgrade

**Branch**: `002-frontend-load-performance` | **Date**: 2026-04-01 | **Spec**: [spec.md](C:\Users\goohf\Desktop\parceiros\specs\002-frontend-load-performance\spec.md)  
**Input**: Feature specification from `/specs/002-frontend-load-performance/spec.md`

## Summary

Melhorar o carregamento inicial do frontend e a abertura da visao da empresa reduzindo bundle inicial, adiando codigo de rotas pesadas, limitando requests por contexto de tela e removendo renderizacoes custosas na listagem de estoque. O foco principal e transformar o frontend atual em um cliente com carregamento sob demanda, estados de tela mais isolados e performance previsivel para catalogos grandes.

## Technical Context

**Language/Version**: TypeScript 5.9 + React 19  
**Primary Dependencies**: Vite 8, React DOM 19, Tailwind CSS 4  
**Storage**: N/A no frontend; consome API Fastify autenticada no backend  
**Testing**: `npm run build`, `npm run lint`, medicao de bundle Vite, verificacao manual com DevTools  
**Target Platform**: Navegadores desktop modernos no painel administrativo  
**Project Type**: web application  
**Performance Goals**: bundle inicial <= 65 kB gzip de JS; primeira pintura navegavel do dashboard <= 1.2 s com backend aquecido; primeira secao da aba de inventario <= 1.5 s; busca local <= 100 ms com 300+ produtos  
**Constraints**: manter comportamento visual atual; nao quebrar fluxos de estoque/custos; preservar autenticacao admin; nao exigir alteracoes obrigatorias na API publica  
**Scale/Scope**: painel admin com 90-500 produtos por empresa, dezenas de variantes por item, navegao frequente entre dashboard, empresa, custos e docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Zero Trust Identity Verification**: PASS. O plano nao altera autenticacao nem caching de credenciais no frontend alem do que ja existe em sessao admin.
- **Dual-Database Boundary Enforcement**: PASS. As mudancas sao apenas de consumo e organizacao de dados no cliente, sem mover persistencia de catalogo para o frontend.
- **Redis-Backed Performance Controls**: PASS. O plano aproveita a melhora recente do backend e evita gerar pressao desnecessaria no cache/Redis por requests redundantes.
- **Non-Reversible Credential Storage**: PASS. Nenhuma mudanca proposta exige armazenar chaves fora do fluxo atual.
- **Security-Critical Testability and Auditability**: PASS. O plano inclui validacao por bundle, request waterfall e testes manuais por rota.

## Project Structure

### Documentation (this feature)

```text
specs/002-frontend-load-performance/
├── plan.md
├── research.md
├── data-model.md
└── quickstart.md
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── CompanyCardsDashboard.tsx
│   │   ├── CompanyDetailPage.tsx
│   │   ├── CostCalculatorPage.tsx
│   │   ├── PublicInventoryApiDocsPage.tsx
│   │   └── ...
│   └── lib/
│       └── api.ts
└── vite.config.ts

tests/
backend/
```

**Structure Decision**: Trabalhar somente no `frontend/`, com foco em quebra por rota, isolamento de fetches e refinamento do view model de inventario. Nenhuma alteracao de estrutura do backend e obrigatoria para o MVP dessa melhoria.

## Phase 0: Research Summary

Baseline confirmado no frontend atual:

- O bundle principal atual sai como um unico chunk de aproximadamente `80.77 kB gzip` em `frontend/dist/assets/index-*.js`.
- `App.tsx` concentra orquestracao de navegacao, sessao, fetches e modais em um unico modulo grande, importando paginas pesadas de forma eager.
- `CompanyDetailPage.tsx` concentra varias subareas da visao da empresa em um unico componente grande, com custo de parse/render alto.
- A entrada na visao da empresa dispara requests em conjunto para inventario e API keys mesmo quando a aba relevante e apenas `inventory`.
- A rota de docs publicas e a tela de custos entram no bundle inicial mesmo quando o usuario abre apenas dashboard e estoque.

## Phase 1: Design

### Architecture Decisions

1. **Route-level code splitting**
   - Converter `CompanyDetailPage`, `CostCalculatorPage` e `PublicInventoryApiDocsPage` para `React.lazy`.
   - Manter dashboard leve no chunk inicial.

2. **Tab-scoped data loading**
   - Separar claramente os fetches por aba:
     - `inventory`: inventario + produtos
     - `keys`: apenas chaves
     - `costs`: produtos + cost settings + historico
   - Remover carregamentos laterais que nao agregam na aba atual.

3. **Incremental inventory rendering**
   - Evoluir a paginacao por sessao recem adicionada para um modelo de render estavel:
     - memoizacao de `productsById`
     - segmentacao por lote visivel
     - opcionalmente `content-visibility`/subcomponentes memoizados para cards fechados

4. **Cheaper derived state**
   - Tirar computacoes pesadas do corpo de render:
     - `new Map(products.map(...))` -> `useMemo`
     - filtros de inventario com `useDeferredValue`
     - funcoes auxiliares pesadas movidas para seletores memoizados onde fizer sentido

5. **Network orchestration cleanup**
   - Adicionar politicas de reuso/dedupe no cliente admin para requests repetidos do mesmo recurso.
   - Garantir que efeitos de bootstrap e mudanca de rota nao rebatam endpoints desnecessariamente.

### Implementation Phases

#### Phase 1A - Bundle and Route Split

- Introduzir `React.lazy` + `Suspense` nas paginas pesadas.
- Separar docs publicas e calculadora de custos do chunk inicial.
- Revisar `vite.config.ts` para chunking mais previsivel se o split automatico nao for suficiente.

#### Phase 1B - Data Loading Policy

- Refatorar `App.tsx` para loaders por aba.
- Fazer `refreshCompanyDetail` deixar de carregar sempre `apiKeys` e `inventory` juntos.
- Centralizar regras de fetch por rota/aba num modulo ou funcoes dedicadas.

#### Phase 1C - Inventory Rendering

- Quebrar `CompanyDetailPage` em subcomponentes:
  - header de busca
  - lista de cards
  - card expandido
  - tabela de variantes
- Aplicar memoizacao de props e derivados frequentes.
- Preparar a listagem para crescimento acima de 300 produtos.

#### Phase 1D - Measurement and Hardening

- Regerar build e comparar bundle.
- Medir waterfall no dashboard e na rota de empresa.
- Validar que a busca e troca de sessao continuam responsivas com dados reais.

## Project Risks

- `CompanyDetailPage` centraliza muitos comportamentos; quebrar em subcomponentes exige cuidado para nao perder estado de estoque e variantes.
- O frontend hoje usa `fetch` direto em `api.ts`, sem camada dedicada de cache cliente; dedupe mal implementado pode introduzir estados stale.
- A aba `inventory` possui auto-refresh e auto-sync; qualquer reducao errada de requests pode afetar a percepcao de dados atualizados.

## Validation Strategy

- Comparar bundle Vite antes/depois.
- Validar requests por rota em DevTools:
  - dashboard
  - empresa/inventory
  - empresa/keys
  - empresa/costs
  - docs
- Testar com empresa de catalogo grande e busca ativa.

## Complexity Tracking

Nenhuma violacao de constituicao prevista.
