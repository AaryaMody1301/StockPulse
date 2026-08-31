# StockPulse Release Status

This document distinguishes **source-code completion** from **environment/operator validation**. The repository can be complete while a public production deployment still requires private credentials, contractual rights, infrastructure checks, and owner-level GitHub/legal decisions.

## Source-code status

**Repository implementation: source-complete for the current StockPulse scope.**

The checked-in application, workers, data model, evidence pipeline, thesis workflow, deterministic change intelligence, optional grounded AI, client-side portfolio/watchlist behavior, deployment examples, readiness/liveness probes, tests, and CI gates are implemented.

### Foundation

- runtime validation at provider boundaries;
- centralized symbol normalization;
- bounded process-local rate limiting;
- non-overlapping/idempotent quote polling;
- CI type/lint/test/build gates;
- truthful curated-market product wording;
- separate liveness and readiness endpoints;
- deployment, contribution, security, and release documentation.

### Canonical market data

- database-first canonical quote/profile/history reads with provider fallback;
- 45-second quote freshness and seven-day profile freshness;
- daily-history completeness tied to the latest **completed U.S. market session** rather than a broad calendar-day end tolerance;
- weekends, NYSE holidays, normal closes, and published early closes handled by a shared market calendar;
- Finnhub secrets transmitted by supported authentication header rather than request URL;
- bounded explicit Twelve Data history requests avoid truncating range data with `outputsize`;
- partial quote responses preserve watchlist visibility and do not turn missing portfolio prices into zero-value losses;
- comparison percentage series use a common actual trading-date baseline;
- selected chart ranges never silently fall back to a mislabeled longer range.

### SEC evidence

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
- amended/duplicate reporting-context selection rules;
- instant facts compared by reporting date;
- duration facts compared only across compatible durations;
- quarter-only observations preferred over YTD observations sharing the latest end date;
- unit-safe comparisons;
- source provenance on each change;
- stable “since last review” evidence-ID differences;
- watchlist-level research-change digest for watched companies with saved theses.

### Grounded AI + release experience

- bounded versioned grounding packets;
- strict Fact/Derived/Inference output contract;
- summary and claim citation-ID validation;
- empty-grounding rejection;
- recommendation/positioning/price-target language rejection;
- optional OpenAI-compatible provider integration with timeout/rate limiting;
- explicit “challenge my thesis” upload action;
- deterministic fallback when AI is absent/fails;
- StockPulse branding/metadata cleanup;
- architecture/operations/demo documentation;
- PostgreSQL migration + idempotency verification in CI.

### Runtime readiness

- `/api/health` is a lightweight process liveness probe;
- `/api/ready` verifies PostgreSQL connectivity and that at least one market-data provider is configured;
- readiness reports SEC/AI/app-URL configuration without returning secret values;
- reserved `.example` SEC contact identities are treated as placeholders rather than deployment-ready configuration.

## Deliberately not implemented

These are product/operational choices rather than incomplete hidden dependencies:

- automatic BUY/HOLD/SELL scoring or price targets;
- silent AI upload of local thesis research;
- mandatory accounts/server sync for browser-local research;
- horizontal multi-process web scaling while cache/rate-limit state is process-local;
- unbounded SEC historical crawling from normal interactive ingestion;
- claims that a market-data subscription grants rights it may not grant.

## Owner/repository decisions still required

These cannot be selected truthfully by application code:

1. **Open-source license:** no `LICENSE` has been chosen. The repository remains unlicensed under default copyright rules until the owner selects one.
2. **Branch protection/ruleset:** CI should be required on `main`. If GitHub settings still leave `main` unprotected, an owner/admin must enable the rule because source files alone cannot enforce it.
3. **Repository metadata:** description/homepage/topics can be maintained in GitHub repository settings; they do not affect application correctness.

## Must still be validated in the target environment

Repository CI cannot validate private production configuration. Before a public release, an operator must confirm:

1. real Finnhub/Twelve Data credentials and plan-specific endpoints;
2. market-data display/redistribution rights and required attribution;
3. production PostgreSQL connectivity, permissions, backup/restore, and migration against a real staging copy;
4. real monitored `SEC_USER_AGENT` and identified live SEC ingestion;
5. Nginx/Hostinger/VPS proxy headers, TLS, process supervision, and restart behavior;
6. optional AI key/model behavior if that feature is enabled;
7. `/api/health` and `/api/ready` through the actual deployed reverse proxy;
8. browser-level interaction smoke tests in the deployed site.

Current Twelve Data guidance states that individual plans are intended for personal/internal use and do not grant commercial third-party display/redistribution rights; public display/redistribution can require business licensing, exchange permissions/add-ons, and attribution. Re-check the current provider contract immediately before launch because licensing terms can change independently of this codebase.

Those checks depend on secrets, provider contracts, production infrastructure, or owner decisions and therefore cannot be truthfully marked complete by source-code CI alone.
