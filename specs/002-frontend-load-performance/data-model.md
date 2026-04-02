# Data Model: Frontend Load Performance Upgrade

## Entity: Route Load Segment

**Purpose**: Representa o menor conjunto de codigo e dados necessario para montar uma rota sem carregar modulos adjacentes.

**Fields**:
- `routeId`: identificador logico da rota (`dashboard`, `company`, `costs`, `docs`)
- `componentChunk`: modulo React carregado sob demanda
- `requiredQueries`: lista de recursos necessarios para a rota ou aba
- `fallbackUi`: estado visual exibido enquanto o chunk ou os dados chegam

**Relationships**:
- Um `Route Load Segment` pode conter varios `Tab Data Slices`.

## Entity: Tab Data Slice

**Purpose**: Descrever o conjunto de requests obrigatorios para uma aba da visao da empresa.

**Fields**:
- `tabId`: `profile`, `keys`, `inventory`, `costs`
- `queries`: requests permitidos para a aba
- `refreshPolicy`: bootstrap, manual, intervalado
- `dedupeKey`: chave de reuso para evitar requests duplicados

**Relationships**:
- `inventory` depende de `AdminInventoryItem[]` e `Product[]`
- `keys` depende de `ApiKeySummary[]`
- `costs` depende de `Product[]`, `CostSettings`, `CostSettingsHistoryEntry[]`

## Entity: Inventory View Model

**Purpose**: Concentrar os dados usados para renderizar a aba de estoque sem recomputar tudo no corpo principal do componente.

**Fields**:
- `productsById`: mapa memoizado de produto por `productId`
- `filteredInventory`: lista filtrada por termo normalizado
- `visibleInventory`: sublista da sessao atual
- `openInventoryProductId`: card expandido
- `inventoryDrafts`: rascunhos de estoque manual
- `inventoryVariantDrafts`: rascunhos de estoque por variante

**Relationships**:
- Cada item referencia um `Product`
- Cada item pode expor varias `Variant Rows`

## Entity: Variant Row

**Purpose**: Representar uma linha de variante com custo, peso e estoque sem recalculo redundante.

**Fields**:
- `variantId`
- `displayLabel`
- `weightGrams`
- `cost`
- `stockWeightGrams`
- `stockUnits`
- `saveState`

## Entity: Performance Budget

**Purpose**: Tornar mensuravel a melhoria.

**Fields**:
- `initialJsGzipBudget`
- `dashboardInteractiveBudgetMs`
- `inventoryFirstSectionBudgetMs`
- `inventorySearchBudgetMs`
- `allowedRequestsPerRoute`

## State Transitions

### Inventory Route

1. `idle` -> `route chunk loading`
2. `route chunk loading` -> `shell rendered`
3. `shell rendered` -> `tab data loading`
4. `tab data loading` -> `first section ready`
5. `first section ready` -> `expanded card open`

### Search Flow

1. `search input updated`
2. `deferred query applied`
3. `filtered inventory recalculated`
4. `session index clamped/reset`
5. `visible inventory rendered`
