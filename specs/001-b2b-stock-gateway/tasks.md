# Tasks: B2B Stock Gateway

**Input**: Design documents from `/specs/001-b2b-stock-gateway/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Security-critical flows are mandatory by constitution, so unit,
integration, and contract tests are included.

**Organization**: Tasks are grouped by user story to enable independent
implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Initialize Node.js + TypeScript service structure in `src/`, `tests/`, and `prisma/`
- [X] T002 Create `package.json`, `tsconfig.json`, and base scripts for dev, build, test, and lint
- [X] T003 [P] Create environment loader in `src/config/env.ts`
- [X] T004 [P] Create structured logger setup in `src/config/logger.ts`
- [X] T005 [P] Create shared app bootstrap in `src/app.ts` and `src/server.ts`
- [X] T006 [P] Create clients for PostgreSQL, Redis, and Supabase in `src/lib/postgres.ts`, `src/lib/redis.ts`, and `src/lib/supabase.ts`
- [X] T007 Create base error handling middleware in `src/middleware/error-handler.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T008 Define Prisma schema for `companies` and `api_keys` in `prisma/schema.prisma`
- [X] T009 Generate initial migration for local control-plane tables in `prisma/migrations/`
- [X] T010 [P] Implement API key hashing helpers in `src/utils/crypto.ts`
- [X] T011 [P] Implement cache and rate-limit key builders in `src/utils/cache-keys.ts`
- [X] T012 Implement API key lookup and company-state verification service in `src/modules/auth/api-key.service.ts`
- [X] T013 Implement request auth types and tenant context in `src/modules/auth/auth.types.ts`
- [X] T014 Implement zero-trust authentication middleware in `src/modules/auth/auth.middleware.ts`
- [X] T015 Implement Redis-backed rate-limit middleware in `src/middleware/rate-limit.middleware.ts`
- [X] T016 [P] Add auth and rate-limit unit coverage in `tests/unit/api-key.service.test.ts`
- [X] T017 [P] Add integration coverage for blocked and revoked access in `tests/integration/auth.integration.test.ts`

**Checkpoint**: Control plane, authentication, and rate limiting are ready for
feature work.

---

## Phase 3: User Story 1 - Empresa consulta produtos com seguranca (Priority: P1)

**Goal**: Deliver a secure public endpoint that returns product data for authorized
B2B companies.

**Independent Test**: Call `GET /api/v1/products` with a valid key and confirm
authorized response, cache usage, and remote fallback behavior.

### Tests for User Story 1

- [X] T018 [P] [US1] Create products contract test in `tests/contract/products.contract.test.ts`
- [X] T019 [P] [US1] Create products integration test in `tests/integration/products.integration.test.ts`
- [X] T020 [P] [US1] Create products service unit test in `tests/unit/products.service.test.ts`

### Implementation for User Story 1

- [X] T021 [P] [US1] Create product response schemas in `src/modules/products/products.schemas.ts`
- [X] T022 [US1] Implement Supabase read and cache-aside logic in `src/modules/products/products.service.ts`
- [X] T023 [US1] Implement public products route in `src/modules/products/products.routes.ts`
- [X] T024 [US1] Register auth and rate-limit middleware for the products route in `src/app.ts`
- [X] T025 [US1] Add structured logging for upstream/cache decisions in `src/modules/products/products.service.ts`

**Checkpoint**: The public products endpoint is functional and testable on its own.

---

## Phase 4: User Story 2 - Operador administra empresas e chaves (Priority: P2)

**Goal**: Provide internal administration endpoints for company and API key
lifecycle management.

**Independent Test**: Create a company, issue a key, deactivate a company, and
revoke a key using only admin endpoints and database assertions.

### Tests for User Story 2

- [X] T026 [P] [US2] Create admin integration coverage in `tests/integration/admin.integration.test.ts`

### Implementation for User Story 2

- [X] T027 [P] [US2] Create admin validation schemas in `src/modules/admin/admin.schemas.ts`
- [X] T028 [US2] Implement company and key management service in `src/modules/admin/admin.service.ts`
- [X] T029 [US2] Implement admin routes for companies and API keys in `src/modules/admin/admin.routes.ts`
- [X] T030 [US2] Implement one-time API key issuance flow with plaintext return and hashed persistence in `src/modules/admin/admin.service.ts`

**Checkpoint**: Internal administration is functional independently of the public
catalog route.

---

## Phase 5: User Story 3 - Plataforma aplica bloqueios e limites automaticamente (Priority: P3)

**Goal**: Ensure automatic blocking, throttling, and safe degradation behavior under
invalid or excessive usage.

**Independent Test**: Deactivate a company, revoke a key, exceed the configured rate
limit, and simulate upstream failure to confirm policy enforcement.

### Tests for User Story 3

- [X] T031 [P] [US3] Create rate-limit integration coverage in `tests/integration/rate-limit.integration.test.ts`
- [X] T032 [P] [US3] Add upstream failure and stale-cache integration scenarios in `tests/integration/products.integration.test.ts`

### Implementation for User Story 3

- [X] T033 [US3] Add policy-aware denial responses for inactive company and revoked key in `src/modules/auth/auth.middleware.ts`
- [X] T034 [US3] Add retry-safe Redis window handling and limit headers in `src/middleware/rate-limit.middleware.ts`
- [X] T035 [US3] Add stale-cache fallback and explicit upstream failure responses in `src/modules/products/products.service.ts`
- [X] T036 [US3] Add structured audit logging for denied and throttled requests in `src/config/logger.ts` and route handlers

**Checkpoint**: Security and resilience rules are fully enforced and observable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T037 [P] Document setup and validation flow in `README.md`
- [ ] T038 [P] Finalize quickstart validation against the running service using `specs/001-b2b-stock-gateway/quickstart.md`
- [X] T039 [P] Verify OpenAPI contract and align route payloads with `specs/001-b2b-stock-gateway/contracts/openapi.yaml`
- [X] T040 Run the complete automated test suite and fix remaining issues

---

## Phase 7: Super Admin Upgrade

**Goal**: Remodel the admin experience into a Super Admin dashboard that manages
company settings, API keys, and per-company inventory without requiring customer
API keys.

**Independent Test**: Open the dashboard, navigate to a company detail screen,
edit the company settings, issue/revoke a key, and save the company-specific
inventory through the internal admin routes only.

### Tests for Super Admin Upgrade

- [X] T041 [P] [US4] Extend the fast test harness with internal admin inventory coverage in `tests/run.cjs`
- [X] T042 [P] [US4] Update the OpenAPI contract for internal Super Admin routes in `specs/001-b2b-stock-gateway/contracts/openapi.yaml`

### Implementation for Super Admin Upgrade

- [X] T043 [US4] Expand control-plane repository summaries with API key counters in `src/lib/postgres.ts`
- [X] T044 [US4] Add company update and inventory admin flows in `src/modules/admin/admin.schemas.ts`, `src/modules/admin/admin.service.ts`, and `src/modules/admin/admin.routes.ts`
- [X] T045 [US4] Register internal admin route aliases in `src/app.ts`
- [X] T046 [US4] Remodel the React app into a company cards dashboard in `frontend/src/App.tsx` and `frontend/src/components/CompanyCardsDashboard.tsx`
- [X] T047 [US4] Build the company detail experience with settings and inventory tabs in `frontend/src/components/CompanyDetailPage.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 must finish before Phase 2.
- Phase 2 blocks all user stories.
- After Phase 2, User Story 1 should go first because it defines the public value
  path and validates the auth stack.
- User Story 2 and User Story 3 can proceed once shared auth and data-access pieces
  are stable, but User Story 3 still depends on middleware created in earlier phases.
- Polish starts only after the desired user stories are complete.

### Parallel Opportunities

- `T003`, `T004`, `T006` can run in parallel.
- `T010` and `T011` can run in parallel.
- `T016` and `T017` can run in parallel.
- `T018`, `T019`, and `T020` can run in parallel.
- `T026`, `T031`, and `T032` can run in parallel with non-conflicting service work.

## Implementation Strategy

### MVP First

1. Finish Setup and Foundational work.
2. Deliver User Story 1.
3. Validate the public products endpoint with a seeded company and API key.

### Incremental Delivery

1. Add internal admin capabilities.
2. Add stronger blocking, resilience, and observability behaviors.
3. Finish documentation and final verification.
