# Implementation Plan: B2B Stock Gateway

**Branch**: `001-b2b-stock-gateway` | **Date**: 2026-03-24 | **Spec**: [spec.md](C:\Users\goohf\Desktop\parceiros\specs\001-b2b-stock-gateway\spec.md)  
**Input**: Updated feature specification for partner-facing inventory read/write routes plus the existing Super Admin dashboard and per-company inventory management

## Summary

Preserve the Super Admin workspace while formalizing the public B2B inventory
surface that partners use autonomously. The backend must expose authenticated
read/write routes under `/api/v1/my-inventory`, derive `companyId` exclusively
from the validated credential context, and persist stock updates atomically in
PostgreSQL without leaking cross-tenant access.

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript 5.x, React 19 + TypeScript  
**Primary Dependencies**: Fastify, Zod, Prisma, ioredis, @supabase/supabase-js, pino, ws-compatible realtime layer, React, Vite, Tailwind CSS  
**Storage**: PostgreSQL for companies, API keys, master products, and company inventory; Redis for cache and rate-limit counters; Supabase remains upstream source of truth for master catalog sync  
**Testing**: Existing `npm test` suite plus new admin integration checks for company summaries, internal admin inventory routes, and company-detail workflow coverage  
**Target Platform**: Linux server container or VM for backend, modern evergreen browsers for frontend  
**Project Type**: web-service + web-app  
**Performance Goals**: dashboard should load company summaries in a single admin-friendly screen; company inventory view should return the full master catalog with tenant quantities in a single request under normal load  
**Constraints**: internal admin routes must not depend on partner API key middleware, internal admin auth must remain mandatory, stock edits must stay scoped to the target company, plaintext API keys remain forbidden  
**Scale/Scope**: dozens to low hundreds of companies, thousands of master products, one Super Admin interface with company cards, company detail tabs, and direct stock editing

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Zero Trust Identity Verification**: PASS. Internal admin inventory routes will
  bypass partner API key middleware only after passing the existing admin identity
  guard; fail-closed behavior remains mandatory.
- **Dual-Database Boundary Enforcement**: PASS. The Super Admin inventory view joins
  `master_products` and `company_inventory` inside PostgreSQL without redefining the
  master catalog source of truth.
- **Redis-Backed Performance Controls**: PASS. Existing Redis behavior for public API
  caching and rate limiting remains intact; the admin upgrade does not remove or
  weaken it.
- **Non-Reversible Credential Storage**: PASS. API key issuance and revocation remain
  in the admin domain, but stored credential material continues to be hash-only.
- **Security-Critical Testability and Auditability**: PASS. Plan adds coverage for
  internal admin route protection, company-context editing, and isolation of stock
  changes between companies.

## Project Structure

### Documentation (this feature)

```text
specs/001-b2b-stock-gateway/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- app.ts
|-- config/
|-- lib/
|-- middleware/
|-- modules/
|   |-- admin/
|   |-- auth/
|   |-- inventory/
|   |-- products/
|   |-- realtime/
|   `-- webhooks/
`-- utils/

frontend/
|-- src/
|   |-- App.tsx
|   |-- components/
|   |-- lib/
|   `-- types.ts
`-- package.json
```

**Structure Decision**: Keep the existing repository shape but shift the frontend
entry experience toward an admin-first dashboard. Extend `src/modules/admin` rather
than creating a separate admin service so company settings, API key operations, and
company stock management stay under one internal boundary.

## Phase 0: Research Decisions

- Use the **existing admin authentication model** as the required guard for the new
  internal stock routes so admin flows bypass partner API key validation without
  becoming anonymous.
- Enrich the **company list response with aggregated API key counts** so the dashboard
  can render cards in one request instead of making a request per company.
- Model the **company inventory admin view as a left join** from `master_products` to
  `company_inventory` filtered by `companyId`, guaranteeing that every master product
  appears even when the company has no custom row yet.
- Add a **company detail update route** for name and active status so the new
  Configuracoes tab can edit company-level fields without overloading stock routes.
- Keep the existing partner-facing inventory flows available, but reposition the
  frontend navigation so the Super Admin dashboard becomes the primary experience.

## Phase 1: Design Artifacts

### Backend Admin API Surface

- Keep admin auth mandatory on all internal management routes.
- Add or evolve admin routes so the frontend can support:
  - list company summaries with key counts
  - fetch one company detail in context
  - update company name and active status
  - list, issue, and revoke API keys scoped to the selected company
  - list and update stock for the selected company
- Introduce the new stock routes requested under the internal admin namespace:
  - `GET /api/internal/admin/companies/:companyId/inventory`
  - `PUT /api/internal/admin/companies/:companyId/inventory/:productId`

### Company Summary and Detail Queries

- Company summary payload should include:
  - company identity fields
  - active/inactive state
  - total API key count
  - optional additional key status counts when useful
- Company detail payload should support the Configuracoes tab without requiring the
  frontend to reconstruct company state from multiple partial responses.

### Admin Inventory Query Model

- The inventory listing route should join `master_products` with
  `company_inventory` for the selected company.
- The response should include:
  - product identity and labels from `master_products`
  - master reference stock
  - the company's `custom_stock_quantity` when present
  - an effective stock field for display when the company has not customized a row yet
- The inventory update route should upsert `company_inventory` by
  `(companyId, productId)` and return the updated view row.

### Frontend: Super Admin Dashboard

- Replace the current landing experience with a dashboard of company cards.
- Each card should clearly communicate:
  - company name
  - active/inactive status
  - quantity of issued keys
- Clicking a card should open a dedicated company view rather than a loose side panel
  pattern.

### Frontend: Company View

- The company view should expose two primary sections or tabs:
  - `Configuracoes`
  - `Estoque da Empresa`
- `Configuracoes` should allow:
  - editing company name
  - activating/inactivating the company
  - listing keys for that company
  - issuing and revoking keys in that same context
- `Estoque da Empresa` should allow:
  - listing all master products for the selected company
  - editing the company-specific stock value inline or in a modal
  - saving each change through the new internal admin inventory route

### Testing Strategy

- Add backend checks for:
  - admin auth enforcement on the new internal inventory routes
  - correct join behavior when a company has no custom inventory rows
  - stock update isolation between two different companies
  - company summary responses including key counts
- Add frontend validation for:
  - dashboard card rendering
  - company detail navigation
  - tab switching between Configuracoes and Estoque da Empresa
  - inventory edit persistence through the new admin route

## Post-Design Constitution Re-Check

- Zero trust remains preserved because bypassing the public API key middleware does
  not bypass authentication; it changes only which authenticated actor is in control.
- Dual-database separation remains preserved because company stock edits continue to
  operate on local `company_inventory` while `master_products` stays a derived replica
  of Supabase.
- Redis remains part of the platform performance model and is unaffected by the admin
  UI remodel.
- Credential storage remains non-reversible.
- Security-critical coverage grows to include internal admin inventory operations.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Admin inventory bypasses partner middleware | Needed so Super Admin can manage any company without simulating a customer API key | Reusing partner routes in the admin UI would force fake client behavior and weaken the product distinction between public and internal flows |
