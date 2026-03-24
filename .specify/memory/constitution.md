<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles:
  - Placeholder Principle 1 -> Zero Trust Identity Verification
  - Placeholder Principle 2 -> Dual-Database Boundary Enforcement
  - Placeholder Principle 3 -> Redis-Backed Performance Controls
  - Placeholder Principle 4 -> Non-Reversible Credential Storage
  - Placeholder Principle 5 -> Security-Critical Testability and Auditability
- Added sections:
  - Security and Performance Standards
  - Delivery Workflow and Quality Gates
- Removed sections:
  - None
- Templates requiring updates:
  - ⚠ pending: .specify/templates/plan-template.md
  - ⚠ pending: .specify/templates/spec-template.md
  - ⚠ pending: .specify/templates/tasks-template.md
  - ⚠ pending: .specify/templates/commands/*.md
- Follow-up TODOs:
  - None
-->

# parceiros Constitution

## Core Principles

### I. Zero Trust Identity Verification
Every protected API request MUST be authenticated on each call. The platform MUST
validate the presented API credential, resolve the owning company, and confirm both
the company and the specific credential remain active before any business data is
returned. When identity state cannot be verified, the request MUST fail closed.

### II. Dual-Database Boundary Enforcement
Administrative and security data MUST live in the local PostgreSQL control plane.
Product catalog data MUST be consumed read-only from the remote inventory source.
The service MUST NOT treat the remote catalog source as a place to persist
administrative state, and the local control database MUST NOT become an alternative
source of truth for product records.

### III. Redis-Backed Performance Controls
Redis MUST be the first-class performance layer for cache-aside product retrieval
and rate-limit counters. Cache keys, TTL strategy, and invalidation behavior MUST be
explicitly documented. If Redis becomes unavailable, security-sensitive flows such as
rate limiting MUST fail in a controlled way rather than silently degrade.

### IV. Non-Reversible Credential Storage
Plaintext API keys MUST never be stored in the local database, logs, fixtures, or
admin exports. Persisted credential material MUST be non-reversible and compared
through deterministic verification logic appropriate for server-issued API keys.
Operational tooling MAY reveal only a short key prefix for identification.

### V. Security-Critical Testability and Auditability
Authentication, revocation, inactive-company blocking, rate limiting, cache behavior,
and remote-source failure modes MUST have automated coverage before release.
Security decisions and denied requests MUST produce structured logs with enough
context for auditing without leaking secrets.

## Security and Performance Standards

- Protected routes MUST require a credential in a standard authorization header.
- Company deactivation and key revocation MUST take effect on the next request.
- Product reads MUST prefer cached results when fresh data is available.
- When the remote catalog source is unavailable, the service MAY serve a still-valid
  cached response; otherwise it MUST return a clear upstream failure.
- Sensitive configuration MUST be supplied through environment variables or secret
  managers, never hardcoded into source files.

## Delivery Workflow and Quality Gates

- Every feature spec and implementation plan MUST explain how it preserves the
  zero-trust boundary, the dual-database model, and the Redis strategy.
- Pull requests MUST include evidence for unit or integration coverage of the
  security-critical paths they modify.
- Contract changes for public API routes MUST update the feature contracts and
  quickstart documentation in the same change.
- Any proposal to store plaintext credentials, bypass validation middleware, or move
  product writes into the gateway is automatically non-compliant and MUST be rejected.

## Governance

This constitution overrides lower-priority project habits when they conflict.
Amendments MUST document the rationale, affected principles, and migration impact.
Semantic versioning applies to this constitution: MAJOR for incompatible governance
changes, MINOR for new principles or materially expanded rules, and PATCH for
clarifications only. Compliance reviews MUST happen during planning, implementation,
and final review for every feature that touches authentication, storage, caching,
rate limiting, or external data access.

**Version**: 1.0.0 | **Ratified**: 2026-03-23 | **Last Amended**: 2026-03-23
