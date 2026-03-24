# Research: B2B Stock Gateway

## Decision 1: Promote the frontend to an admin-first dashboard

- **Decision**: Make the main landing experience a Super Admin dashboard with company
  cards instead of centering the UI on a simulated partner API-key flow.
- **Rationale**: The user goal has shifted from technical simulation to operational
  management of clients, keys, and stock by internal staff.
- **Alternatives considered**:
  - Keep the current simulated-client landing page and add admin tools as secondary
    panels: lower disruption, but keeps the wrong mental model for daily operations.

## Decision 2: Aggregate company card metrics in the backend

- **Decision**: Return company summary data with API key counts from the backend
  instead of deriving those counts on the frontend through many follow-up requests.
- **Rationale**: The dashboard should be admin-friendly and load useful summaries in
  one pass.
- **Alternatives considered**:
  - Request key lists per company from the browser: workable, but chatty and slower
    as the number of companies grows.

## Decision 3: Use internal admin inventory routes with admin authentication

- **Decision**: Add dedicated internal admin routes for company inventory management
  that bypass partner API key middleware but remain protected by admin auth.
- **Rationale**: The admin must act on behalf of any company without pretending to be
  that company, while still preserving zero trust.
- **Alternatives considered**:
  - Reuse `my-inventory` by injecting a company API key in the frontend: operationally
    confusing and weaker as an admin model.

## Decision 4: Build the admin inventory response from a left join

- **Decision**: The company inventory admin route should left join `master_products`
  with `company_inventory` for the selected company.
- **Rationale**: This guarantees that every product from the master catalog appears
  even when the company has not customized stock yet.
- **Alternatives considered**:
  - Return only `company_inventory` rows: simpler query, but incomplete UI because
    untouched products disappear.

## Decision 5: Add a company-detail editing route for Configuracoes

- **Decision**: Support updating company name and status through a dedicated admin
  company-detail mutation.
- **Rationale**: The Configuracoes tab needs one coherent backend action instead of
  forcing the frontend to split company metadata across disconnected endpoints.
- **Alternatives considered**:
  - Use only the existing status-only route and leave name immutable: insufficient for
    the requested company management experience.
