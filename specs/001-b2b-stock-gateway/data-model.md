# Data Model: B2B Stock Gateway

## Core Tables

### companies

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | Primary key |
| legal_name | text | Required |
| external_code | text | Unique business identifier |
| is_active | boolean | Default `true`; affects public partner access, but company remains manageable by Super Admin |
| created_at | timestamptz | Server-generated |
| updated_at | timestamptz | Server-generated |

### api_keys

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to `companies.id` |
| key_prefix | varchar(12) | Non-sensitive display identifier |
| key_hash | varchar(128) | Deterministic HMAC hash, never plaintext |
| rate_limit_per_minute | integer | Positive required limit |
| is_revoked | boolean | Default `false` |
| revoked_at | timestamptz | Null unless revoked |
| last_used_at | timestamptz | Updated on successful authenticated public calls |
| created_at | timestamptz | Server-generated |

### master_products

| Field | Type | Rules |
|-------|------|-------|
| id | text/uuid | Upstream product identifier; primary key |
| sku | text | Required |
| name | text | Required |
| master_stock | integer | Non-negative quantity replicated from Supabase |
| updated_at | timestamptz | Mirrors catalog freshness and sync updates |

### company_inventory

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to `companies.id` |
| product_id | text/uuid | Foreign key to `master_products.id` |
| custom_stock_quantity | integer | Non-negative tenant-specific quantity |
| updated_at | timestamptz | Server-generated on create/update |

**Uniqueness rule**: `company_inventory` must enforce one row per
`(company_id, product_id)` pair.

## Derived Admin Views

### AdminCompanySummary

Logical view used by the Super Admin dashboard cards:

| Field | Source | Rule |
|-------|--------|------|
| company_id | `companies.id` | Required |
| legal_name | `companies.legal_name` | Required |
| external_code | `companies.external_code` | Required |
| is_active | `companies.is_active` | Required |
| api_key_count | Aggregated from `api_keys` | Total number of keys issued for the company |
| active_key_count | Aggregated from `api_keys` | Optional derived metric when useful for the UI |
| updated_at | `companies.updated_at` | For freshness and sorting |

### AdminCompanyDetail

Logical view used by the company-specific Configuracoes tab:

| Field | Source | Rule |
|-------|--------|------|
| company fields | `companies` | Editable company metadata |
| api_keys | `api_keys` filtered by `company_id` | Used to list, issue, and revoke keys in context |

### AdminCompanyInventoryView

Logical view returned by the new internal admin inventory route:

| Field | Source | Rule |
|-------|--------|------|
| company_id | Route context | Required |
| product_id | `master_products.id` | Required |
| sku | `master_products.sku` | Required |
| name | `master_products.name` | Required |
| master_stock | `master_products.master_stock` | Reference quantity from the master catalog |
| custom_stock_quantity | `company_inventory.custom_stock_quantity` | Nullable when the company has not customized the product |
| effective_stock_quantity | Derived | `custom_stock_quantity` when present, else `master_stock` |
| updated_at | Derived | Latest relevant timestamp for admin display |

## Relationships

- One `company` has many `api_keys`.
- One `company` has many `company_inventory` rows.
- One `master_product` can be referenced by many `company_inventory` rows.
- One `company_inventory` row belongs to exactly one `company` and one
  `master_product`.
- `master_products` remains a local replica of the Supabase catalog, not an
  independent source of truth.

## State Transitions

### Company

- `active` -> `inactive`: public partner API access is blocked on the next request
- `inactive` -> `active`: public partner access resumes immediately for non-revoked keys
- `active|inactive` -> `edited`: Super Admin updates name or metadata in Configuracoes

### ApiKey

- `active` -> `revoked`: public partner API calls are blocked
- `active` -> `rate_limited`: runtime state controlled in Redis for public APIs

### CompanyInventory

- `inherited` -> `customized`: Super Admin or company-specific flow creates its own stock value
- `customized` -> `customized`: quantity is edited again for the same company/product pair

## Redis Logical Keys

### Public products cache snapshot

- **Key**: `products:list:v1`
- **Value**: JSON snapshot used by public catalog routes
- **TTL**: short-lived freshness window with optional stale grace window

### Tenant rate-limit counter

- **Key**: `rl:{companyId}:{apiKeyId}:{window}`
- **Value**: integer counter
- **TTL**: 60 seconds or remaining seconds in the current minute window
