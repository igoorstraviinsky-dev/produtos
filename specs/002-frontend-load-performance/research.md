# Research: Frontend Load Performance Upgrade

## Decision 1: Usar code splitting por rota nas telas pesadas

**Decision**: Carregar `CompanyDetailPage`, `CostCalculatorPage` e `PublicInventoryApiDocsPage` com `React.lazy` e `Suspense`.

**Rationale**:
- `App.tsx` importa todas as paginas de forma eager.
- As rotas de docs e custos nao precisam bloquear o dashboard inicial.
- O bundle atual ainda sai concentrado demais para um painel que navega por poucas rotas principais.

**Alternatives considered**:
- Manter bundle unico e otimizar apenas renderizacao. Rejeitado porque continua pagando parse/download de telas nao usadas.
- Chunk manual pesado no Vite sem lazy loading. Rejeitado porque reduz previsibilidade e nao resolve carga eager por import.

## Decision 2: Separar fetches por aba em vez de um refresh generico da empresa

**Decision**: Refatorar a politica de fetch do `App.tsx` para que cada aba carregue apenas os dados que realmente usa.

**Rationale**:
- Hoje a visao da empresa chama `refreshCompanyDetail`, que busca inventario e API keys em paralelo mesmo quando a aba relevante e apenas estoque.
- Custos tambem possuem fluxo proprio e nao precisam compartilhar bootstrap com chaves.

**Alternatives considered**:
- Manter fetch conjunto e confiar no backend otimizado. Rejeitado porque ainda aumenta waterfall e tempo percebido.
- Criar uma unica chamada backend agregada. Rejeitado para este ciclo porque aumenta acoplamento sem necessidade imediata.

## Decision 3: Evoluir o inventario para renderizacao incremental e memoizada

**Decision**: Manter a segmentacao por sessoes e complementar com subcomponentes memoizados e derivados cacheados.

**Rationale**:
- `CompanyDetailPage.tsx` sozinho concentra quase 58 kB de codigo e muitos calculos inline.
- A lista de inventario e o maior ponto de pressao de renderizacao e cresce com o catalogo.

**Alternatives considered**:
- Introduzir virtualizacao completa agora. Rejeitado no primeiro passo porque aumenta complexidade em tabela de variantes expansivel.
- Deixar apenas a paginacao por sessao. Rejeitado porque ainda sobra muito trabalho repetido em cada render.

## Decision 4: Usar `useMemo` e `useDeferredValue` para busca e mapas derivados

**Decision**: Memoizar mapas/seletores e desacoplar a busca digitada do filtro pesado.

**Rationale**:
- `productsById` ainda e recriado no render.
- A busca do inventario percorre produto + variantes em toda digitacao.
- React 19 ja esta disponivel e suporta esse refinamento sem novas dependencias.

**Alternatives considered**:
- Ignorar a busca por enquanto. Rejeitado porque a busca e o caminho principal com catalogo grande.
- Adicionar biblioteca externa de state/cache cliente. Rejeitado para nao ampliar superficie tecnica antes do necessario.

## Decision 5: Medir com budget explicito apos cada fase

**Decision**: Tratar bundle inicial, requests por rota e tempo da primeira secao do inventario como contratos internos de performance.

**Rationale**:
- Sem meta mensuravel, o frontend pode “parecer melhor” mas continuar fazendo trabalho demais.
- O projeto ja passou por um ciclo de benchmark no backend; o frontend precisa de equivalente simples e repetivel.

**Alternatives considered**:
- Validar apenas manualmente. Rejeitado porque nao cria criterio claro para aceitar a melhoria.
