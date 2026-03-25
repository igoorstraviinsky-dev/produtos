# Feature Specification: B2B Stock Gateway

**Feature Branch**: `001-b2b-stock-gateway`  
**Created**: 2026-03-23  
**Updated**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Criar as rotas B2B de leitura e escrita do estoque isolado por empresa em `/api/v1/my-inventory`, garantindo isolamento por token/API key, atualizacao atomica e validacao E2E do fluxo de leitura + escrita."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Super Admin acompanha todas as empresas em um dashboard (Priority: P1)

O gestor interno abre o painel e enxerga um card para cada empresa cadastrada, com
seu nome, status e resumo operacional, para decidir rapidamente qual cliente precisa
de atencao.

**Why this priority**: O painel deixa de ser um simulador tecnico e passa a ser a
porta principal da operacao administrativa.

**Independent Test**: Pode ser testado populando varias empresas e confirmando que a
tela principal exibe um card por empresa com as informacoes resumidas esperadas.

**Acceptance Scenarios**:

1. **Given** varias empresas cadastradas, **When** o Super Admin abre a tela
   principal, **Then** ele ve um card para cada empresa com nome, status e quantidade
   de chaves emitidas.
2. **Given** uma empresa sem nenhuma chave emitida, **When** seu card e exibido,
   **Then** o painel mostra zero chaves sem quebrar a navegacao.

---

### User Story 2 - Super Admin gerencia configuracoes da empresa em uma visao dedicada (Priority: P1)

Ao clicar no card de uma empresa, o Super Admin entra em uma visao detalhada dessa
empresa e consegue alterar suas configuracoes operacionais e credenciais sem sair do
contexto do cliente selecionado.

**Why this priority**: A operacao diaria exige que o gestor trabalhe empresa por
empresa, com contexto claro e menos troca de tela.

**Independent Test**: Pode ser testado abrindo a visao de uma empresa, alterando o
nome, ativando ou inativando o status e emitindo ou revogando chaves a partir dessa
mesma tela.

**Acceptance Scenarios**:

1. **Given** um card de empresa visivel no dashboard, **When** o Super Admin clica
   nele, **Then** o sistema abre a visao da empresa com uma aba de Configuracoes.
2. **Given** a aba de Configuracoes aberta, **When** o Super Admin altera nome,
   status ou chaves da empresa, **Then** as mudancas ficam salvas para aquela empresa
   especifica.

---

### User Story 3 - Super Admin edita o estoque de qualquer empresa sem usar API key (Priority: P1)

Na visao da empresa, o Super Admin acessa a aba de estoque e edita diretamente a
quantidade personalizada de qualquer produto para aquela empresa, usando o contexto
interno do painel administrativo.

**Why this priority**: Esse e o centro do upgrade solicitado: gerir o estoque por
empresa no painel administrativo sem simular o fluxo do cliente final.

**Independent Test**: Pode ser testado abrindo a aba de estoque de uma empresa,
editando a quantidade de um produto e confirmando que apenas o estoque daquela
empresa foi alterado.

**Acceptance Scenarios**:

1. **Given** uma empresa selecionada, **When** o Super Admin abre a aba Estoque da
   Empresa, **Then** ele ve todos os produtos do catalogo mestre com a quantidade
   especifica daquela empresa.
2. **Given** um produto listado na aba de estoque, **When** o Super Admin altera a
   quantidade e salva, **Then** somente o estoque customizado da empresa selecionada
   e atualizado.

---

### User Story 4 - Painel administrativo continua seguindo zero trust (Priority: P2)

As rotas internas usadas pelo painel Super Admin continuam protegidas e nao aceitam
operacoes administrativas sem autenticacao interna valida, mesmo quando bypassam a
API key do cliente final.

**Why this priority**: O fato de a rota ser interna nao elimina a obrigacao de
verificacao de identidade.

**Independent Test**: Pode ser testado chamando as rotas internas administrativas
sem token interno valido e confirmando que o acesso e negado.

**Acceptance Scenarios**:

1. **Given** uma chamada para listar ou editar o estoque de uma empresa sem
   credencial administrativa valida, **When** a rota interna e acionada, **Then** a
   operacao e negada imediatamente.
2. **Given** uma credencial administrativa valida, **When** o Super Admin edita o
   estoque de uma empresa, **Then** a mudanca e aplicada sem exigir API key da
   propria empresa.

---

### Edge Cases

- A aba de estoque deve listar produtos do catalogo mestre mesmo quando a empresa
  ainda nao possui linha propria em `company_inventory`.
- Uma empresa inativa continua visivel e administravel pelo Super Admin no painel.
- Editar o estoque de uma empresa nao deve alterar o estoque customizado de outra.
- O dashboard deve continuar funcional quando uma empresa tiver zero chaves ativas ou
  zero chaves emitidas.
- Rotas internas administrativas devem falhar de forma fechada quando o token
  administrativo nao puder ser validado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir um dashboard administrativo com um card por
  empresa cadastrada.
- **FR-002**: Cada card de empresa MUST mostrar pelo menos nome, status de atividade
  e quantidade de chaves emitidas.
- **FR-003**: O sistema MUST permitir abrir uma visao detalhada de uma empresa a
  partir do card correspondente.
- **FR-004**: A visao detalhada da empresa MUST conter uma secao ou aba de
  Configuracoes.
- **FR-005**: A visao detalhada da empresa MUST conter uma secao ou aba de Estoque
  da Empresa.
- **FR-006**: O sistema MUST permitir ao Super Admin alterar nome e status da empresa
  dentro da visao detalhada.
- **FR-007**: O sistema MUST permitir ao Super Admin listar, gerar e revogar API keys
  da empresa dentro da visao detalhada.
- **FR-008**: O sistema MUST expor uma rota interna autenticada para listar o estoque
  de qualquer empresa, combinando `company_inventory` com `master_products`.
- **FR-009**: O sistema MUST expor uma rota interna autenticada para atualizar a
  quantidade customizada de qualquer empresa para um produto especifico.
- **FR-010**: A listagem administrativa de estoque MUST incluir todos os produtos do
  catalogo mestre, mesmo quando nao existir quantidade customizada para a empresa.
- **FR-011**: A edicao administrativa de estoque MUST afetar somente a empresa alvo
  da operacao.
- **FR-012**: As rotas internas do painel administrativo MUST bypassar o middleware
  de API key publica do cliente final, mas MUST continuar protegidas por autenticacao
  administrativa interna.
- **FR-013**: O sistema MUST preservar o catalogo mestre como referencia comum sem
  sobrescrever o estoque mestre ao editar o estoque de uma empresa.
- **FR-014**: O sistema MUST continuar armazenando apenas representacao nao
  reversivel das API keys no banco local.
- **FR-015**: O sistema MUST registrar eventos administrativos relevantes sem expor
  segredos nem chaves em texto puro.

### Key Entities *(include if feature involves data)*

- **Company**: Empresa cliente cadastrada, com nome, codigo externo, status e
  relacionamento com chaves e estoque customizado.
- **ApiKey**: Credencial emitida para uma empresa, com hash nao reversivel, prefixo,
  limite por minuto e estado de revogacao.
- **MasterProduct**: Produto do catalogo mestre replicado localmente e usado como
  base para a visualizacao administrativa de estoque por empresa.
- **CompanyInventory**: Quantidade customizada de uma empresa para um produto do
  catalogo mestre.
- **AdminCompanySummary**: Visao resumida usada nos cards do dashboard, contendo
  identificacao da empresa, status e metricas basicas de chaves.
- **AdminCompanyInventoryView**: Visao administrativa que combina dados do catalogo
  mestre com o estoque customizado da empresa selecionada.

## Assumptions

- O painel continua usando autenticacao administrativa interna separada da API key do
  cliente final.
- A quantidade exibida na aba Estoque da Empresa sera a quantidade customizada quando
  existir; caso contrario, o painel mostrara a referencia derivada do catalogo
  mestre.
- O gerenciamento de chaves continua obedecendo a regra de exibicao unica da chave
  em texto puro no momento da emissao.
- A pagina Meu Estoque do parceiro pode continuar existindo, mas o fluxo principal do
  frontend passa a ser o painel Super Admin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O Super Admin consegue identificar e abrir a visao detalhada de uma
  empresa diretamente a partir do dashboard sem depender de simulacao com API key.
- **SC-002**: Mudancas de configuracao e estoque feitas na visao da empresa ficam
  refletidas na leitura seguinte dessa mesma empresa.
- **SC-003**: O painel mostra com clareza empresas sem chaves, empresas inativas e
  empresas com estoque customizado sem quebrar a navegacao.
- **SC-004**: Operacoes administrativas sem autenticacao interna valida tem 100% das
  tentativas bloqueadas na primeira verificacao.
- **SC-005**: Ajustes administrativos de estoque preservam o catalogo mestre e nao
  alteram o estoque customizado de outras empresas.
