# StockPulse Architecture

## Product boundary

StockPulse is an evidence-first research system. It deliberately separates:

1. **Source facts** — external market data and SEC filing/XBRL evidence.
2. **Deterministic calculations** — for example period-over-period metric changes.
3. **User interpretation** — thesis text and explicit evidence relationships.
4. **Optional model inference** — citation-validated synthesis that can be disabled without breaking the first three layers.

The application does not collapse these layers into an automatic BUY/HOLD/SELL score.

## Runtime topology

```text
Browser
  ├─ market / stock / news / compare pages
  ├─ localStorage: watchlist + portfolio
  └─ IndexedDB: thesis records + review checkpoints
          │
          ▼
Next.js Node application
  ├─ API rate limiting / input validation
  ├─ canonical market repository
  ├─ SEC evidence repository
  ├─ deterministic change intelligence
  ├─ grounding packet builder
  └─ optional grounded AI endpoint
          │
          ├────────► PostgreSQL / Prisma
          ├────────► Finnhub / Twelve Data
          ├────────► SEC EDGAR
          └────────► optional OpenAI-compatible AI endpoint

Standalone worker
  └─ quote polling ──► providers + PostgreSQL
```

The production example runs one web process because application cache and rate-limit state are currently process-local.

## Market-data boundary

`src/lib/market/repository.ts` is the canonical read boundary for quote snapshots, daily bars, and company profiles.

The repository applies explicit freshness rules, reads PostgreSQL first where appropriate, falls back to configured market-data providers, and persists provider results best-effort. Main product routes use this boundary instead of calling provider quote/history methods directly.

`src/lib/providers/*` owns transport/provider fallback and runtime validation. External payloads are not accepted as application state until their Zod schemas pass.

## SEC evidence pipeline

```text
ticker
  -> SEC ticker/CIK map
  -> submissions + companyfacts
  -> bounded retry / fair-access queue
  -> optional referenced submission-history files
  -> runtime validation
  -> deterministic normalization
  -> idempotent PostgreSQL inserts
  -> evidence API / stock page
```

Every stored filing retains accession/form/date/source URL provenance. Facts and normalized metrics retain taxonomy/concept/accession context.

Continuation files are fetched only when the recent research-relevant history is thin, and the number of additional files is bounded per ingestion run.

## Deterministic change intelligence

`src/lib/change-intelligence/metric-changes.ts` computes changes from stored normalized observations.

Rules include:

- group by metric and unit;
- never compare incompatible units;
- deterministically choose the latest filed observation for duplicate/amended period data;
- compare the two latest distinct periods;
- expose absolute change;
- expose percentage only when the previous value is nonzero;
- keep current/previous provenance attached to the result.

No direction is automatically labeled good or bad.

## Thesis and review state

Theses are local-first. `src/lib/thesis/schema.ts` validates:

- ticker/title/core thesis;
- assumptions, risks, catalysts, and invalidation criteria;
- evidence relationships (`supports`, `contradicts`, `qualifies`, `unresolved`);
- revision history;
- last-review timestamp and reviewed grounding evidence IDs.

`src/lib/thesis/review.ts` computes research completeness and “since last review” state from stable evidence-ID set differences. This makes review state deterministic even if client clocks differ.

SEC evidence imported into a thesis starts as `unresolved`; the application does not automatically decide what the evidence means to the user’s thesis.

## Grounding and optional AI

`src/lib/ai/grounding.ts` builds a bounded `stockpulse-grounding` packet from stored filings, normalized metrics, and deterministic changes.

Evidence receives stable IDs. Model output must pass a strict `stockpulse-grounded-analysis` schema and post-validation:

- claim type is `Fact`, `Derived`, or `Inference`;
- each claim cites at least one known evidence ID;
- invented IDs fail validation;
- unexpected fields fail validation;
- recommendation / price-target language fails validation.

`src/lib/ai/provider.ts` is intentionally thin. It calls a server-configured OpenAI-compatible Chat Completions endpoint only when both a key and model exist. Remote endpoints must use HTTPS; HTTP is allowed only for loopback development.

The model never receives browser-local thesis text unless the user explicitly invokes “Challenge my thesis.”

## Browser storage

Watchlist and portfolio use validated localStorage records. Legacy `investsmart-*` keys are migration inputs only; valid records are copied to `stockpulse-*` keys.

Thesis research uses IndexedDB and supports JSON export/import. Invalid stored/imported records are ignored or rejected rather than trusted.

## Verification boundary

GitHub Actions runs PostgreSQL 16 as a service, applies checked-in Prisma migrations, exercises an idempotent SEC database write, and then runs type checks, worker checks, ESLint, tests, and the production build.

This verifies repository-level correctness. Production credentials, provider entitlements, real SEC identity, reverse-proxy behavior, and production-network connectivity still require deployment smoke tests because those are environment properties rather than source-code properties.
