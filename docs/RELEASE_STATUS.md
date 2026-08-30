# StockPulse Release Status

This document distinguishes source-code completion from environment/operator validation.

## Implemented in the repository

### Foundation

- runtime validation at provider boundaries;
- centralized symbol normalization;
- bounded process-local rate limiting;
- non-overlapping/idempotent quote polling;
- CI type/lint/test/build gates;
- truthful curated-market product wording;
- health endpoint and deployment examples.

### Canonical data + SEC evidence

- database-first canonical quote/profile/history reads with provider fallback;
- SEC ticker/CIK mapping;
- submissions + companyfacts ingestion;
- bounded retry/backoff and fair-access serialization;
- bounded continuation-history ingestion;
- additive SEC filing/fact/metric schema;
- deterministic metric normalization with provenance;
- idempotent inserts and accurate inserted-row job counts;
- stock evidence API/UI and degraded evidence-first stock page behavior.

### Thesis workspace

- browser-local validated thesis storage;
- assumptions, risks, catalysts, invalidation criteria;
- supports/contradicts/qualifies/unresolved evidence relationships;
- revision history and restore-to-editor workflow;
- versioned import/export;
- explicit evidence review checkpoints;
- deterministic research-completeness/research-debt signal;
- direct import of stored SEC evidence as unresolved thesis evidence.

### Change intelligence

- deterministic period-over-period metric changes;
- amended/duplicate-period selection rules;
- unit-safe comparisons;
- source provenance on each change;
- stable “since last review” evidence-ID differences;
- watchlist-level research-change digest for watched companies with saved theses.

### Grounded AI + release experience

- bounded versioned grounding packets;
- strict Fact/Derived/Inference output contract;
- citation-ID validation and recommendation-language rejection;
- optional OpenAI-compatible provider integration with timeout/rate limiting;
- explicit “challenge my thesis” upload action;
- deterministic fallback when AI is absent/fails;
- StockPulse branding/metadata cleanup;
- architecture/operations/demo documentation;
- PostgreSQL migration + idempotency verification in CI.

## Deliberately not implemented

These are product/operational choices rather than incomplete hidden dependencies:

- automatic BUY/HOLD/SELL scoring or price targets;
- silent AI upload of local thesis research;
- mandatory accounts/server sync for browser-local research;
- horizontal multi-process web scaling while cache/rate-limit state is process-local;
- unbounded SEC historical crawling from normal interactive ingestion;
- claims that a market-data subscription grants rights it may not grant.

## Must still be validated in the target environment

Repository CI cannot validate private production configuration. Before a public release, an operator must confirm:

1. real Finnhub/Twelve Data credentials and plan-specific endpoints;
2. market-data display/redistribution rights;
3. production PostgreSQL connectivity, permissions, backup/restore, and migration against a real staging copy;
4. real `SEC_USER_AGENT` and identified live SEC ingestion;
5. Nginx/Hostinger/VPS proxy headers, TLS, process supervision, and restart behavior;
6. optional AI key/model behavior if that feature is enabled;
7. browser-level interaction smoke tests in the deployed site.

Those checks depend on secrets, provider contracts, and production infrastructure and therefore cannot be truthfully marked complete by source-code CI alone.
