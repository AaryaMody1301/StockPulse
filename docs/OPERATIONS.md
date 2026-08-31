# StockPulse Operations Notes

This document records production assumptions, security boundaries, and checks that should remain explicit when StockPulse is moved between environments.

## Deployment shape

The checked-in configuration assumes:

- Node.js 20.19+; CI uses Node 22;
- one Next.js Node process behind a trusted reverse proxy;
- one quote-polling worker;
- PostgreSQL for persisted market/SEC evidence;
- server-side market-provider credentials;
- a descriptive `SEC_USER_AGENT` before automated EDGAR access;
- optional grounded AI disabled unless a server-side key **and** model are configured;
- build/runtime dependencies available while Prisma generation, migrations, verification, and the build run.

PM2 uses the repository directory by default. Set `STOCKPULSE_APP_DIR` if the processes should run from another filesystem path.

## Horizontal scaling

`src/lib/cache.ts` and `src/lib/rate-limit.ts` use process-local memory. Multiple web instances would have independent caches and independent rate-limit counters.

Before horizontal scaling, move those concerns to coordinated shared state and review the current Next.js self-hosting/multi-instance guidance. Until then, keep the web process at one instance.

## Reverse proxy

The example Nginx configuration terminates TLS and forwards traffic to the Node process on port 3000. It does not depend on a hard-coded application directory; Next.js serves its own static/public assets.

The application’s IP-based rate limiter trusts the configured proxy headers. Do not expose the Node process directly to untrusted clients without re-evaluating `X-Real-IP` / `X-Forwarded-For` trust.

## Canonical market-data reads

`src/lib/market/repository.ts` is the product read boundary for quotes, profiles, and daily bars.

Current freshness rules:

- quote snapshots: database-first up to 45 seconds old;
- company profiles: database-first up to seven days old;
- daily bars: database-first when stored coverage reaches the requested range within a seven-day calendar tolerance.

Provider reads refill PostgreSQL best-effort. Provider failure may fall back to stale stored quote/profile data or partial stored daily history. Homepage, stock detail, quote API, and comparison history all use this canonical boundary.

Do not assume values from different providers have identical timestamps, market coverage, or redistribution rights.

## Quote worker

The quote worker:

- normalizes/de-duplicates configured symbols;
- permits only one poll cycle at a time;
- upserts repeated `(symbolId, timestamp)` snapshots;
- records `success`, `partial`, or `failed` based on actual symbol outcomes.

Finnhub `/quote` does not supply volume. Finnhub-backed snapshot volume is therefore `0`; do not build snapshot-volume analytics from that field. Daily OHLCV history is the appropriate existing volume source.

## SEC EDGAR ingestion

StockPulse uses the public SEC submissions and companyfacts APIs server-side. The data APIs require no API key, but automated access must identify the client and comply with SEC fair-access policy.

References:

- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data

### Identity and request control

Configure a real monitored identity:

```env
SEC_USER_AGENT="StockPulse Research contact@example.com"
```

The SEC client refuses requests without this variable.

Request behavior:

- serialized with at least 150 ms between attempts in one process;
- maximum three attempts for 429, 5xx, network, or timeout failures;
- `Retry-After` honored up to 30 seconds;
- 10-second timeout per attempt;
- continuation filenames validated before constructing a URL.

This stays below the SEC’s published per-user request-rate ceiling within one process. Do not horizontally scale ingestion without a shared/global throttle.

### Submission history

The current submissions payload contains at least one year or the most recent 1,000 filings, whichever is more. When SEC `filings.files` references older continuation JSON and the normalized recent research-relevant set is thin, StockPulse fetches at most two continuation files per ingestion run. Continuation rows are validated and normalized through the same filing pipeline as recent rows.

For large historical bulk backfills, prefer SEC bulk data instead of repeatedly requesting many per-company continuation files.

### Normalization and idempotency

Research-relevant forms currently include 10-K, 10-Q, 8-K, 20-F, 40-F, 6-K and amendments.

Normalized metrics intentionally cover a bounded set of deterministic source concepts: revenue, net income, EPS, cash, long-term debt where a supported source concept exists, shares outstanding, operating cash flow, and capex.

Missing concepts remain missing. StockPulse does not infer a financial fact that the source did not provide.

Filings use unique accession numbers; facts and metrics use deterministic SHA-256 keys. Re-ingestion uses `createMany(..., skipDuplicates: true)`, and job summaries report **actual inserted row counts**, not candidate row counts.

### Ingestion command

```bash
npm run ingest:sec -- AAPL
npm run ingest:sec -- AAPL MSFT NVDA
```

`job_runs` records `success`, `partial`, or `failed`, including endpoint/history errors where relevant.

## Change intelligence and review checkpoints

Metric change detection is deterministic:

- observations are grouped by metric + unit;
- duplicate/amended observations for one period select the latest filing deterministically;
- the latest two distinct periods are compared;
- cross-unit values are never compared;
- a zero prior value produces an absolute delta but no misleading percentage.

The browser-local thesis model stores `lastReviewedAt` plus the stable grounding evidence IDs that were reviewed. “Since last review” is calculated from ID set differences, not from client clock guesses.

The watchlist research digest applies the same calculation to watched companies with saved theses.

## Browser-local data

Theses use IndexedDB. Watchlist and portfolio data use localStorage.

All browser-stored records are runtime-validated before becoming application state. Legacy `investsmart-watchlist` and `investsmart-portfolio` values are copied to `stockpulse-*` keys only after validation, so existing users are migrated without trusting arbitrary local JSON.

Research is not account-synced. Users should export important thesis data regularly. Do not store secrets or API credentials in these browser stores.

## Optional grounded AI

AI is disabled unless both a server-side key and `AI_MODEL` are configured.

Supported configuration:

```env
AI_GATEWAY_API_KEY=""
AI_API_KEY=""
AI_MODEL=""
AI_BASE_URL="https://ai-gateway.vercel.sh/v1"
```

`AI_API_KEY` can be used for another trusted OpenAI-compatible endpoint by changing `AI_BASE_URL`.

The model boundary is deliberately downstream of deterministic evidence:

1. the server builds a bounded `stockpulse-grounding` packet;
2. the packet says evidence/thesis content is untrusted data, not instructions;
3. the provider call has a 20-second timeout and a stricter per-IP request limit;
4. output must be strict JSON matching `stockpulse-grounded-analysis`;
5. every claim must cite known evidence IDs;
6. unknown citations or recommendation/price-target language are rejected before display;
7. failures leave deterministic evidence pages usable.

“Challenge my thesis” uploads the current browser draft only after an explicit button press. Opening or editing the research workspace alone does not send thesis text to an AI provider.

## Database migrations and CI

Production migration:

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
```

GitHub Actions now starts PostgreSQL 16, applies every checked-in migration, runs an SEC idempotency database test, then runs:

```bash
npm run check
npm run build
```

Do not deploy a branch that fails this gate.

The CI database proves migration SQL and basic Prisma/PostgreSQL behavior on a clean disposable database. It does **not** prove target-environment networking, permissions, production data volume, or upgrade behavior for every possible historical production state.

## Deployment smoke checks

After deployment and before public traffic:

1. verify `/api/health`;
2. verify quote/search/news with real provider credentials;
3. verify a stock detail page and comparison route;
4. run one identified SEC ingestion against staging/production PostgreSQL;
5. confirm stored evidence and `/stocks/{symbol}/changes` render;
6. create a local thesis, mark evidence reviewed, and verify the review digest;
7. if AI is configured, run one grounded summary and one challenge-thesis request, then confirm every claim renders evidence IDs;
8. test through the actual reverse proxy, not only localhost.

## Market-data licensing

Provider plan and market-data rights are an architecture constraint. Do not assume a free/personal plan permits public redistribution.

Before public launch, record the actual provider plan privately, verify public display/redistribution rights for each market/data type, add required attribution, and avoid exposing provider credentials or unrestricted proxy endpoints.

## Dependency/security maintenance

Framework/runtime versions are pinned tightly for security-sensitive packages. Do not use `npm audit fix --force` automatically on production code.

Re-run dependency audit and review upstream advisories during release maintenance. A dependency warning that requires a major or breaking downgrade should be evaluated deliberately rather than bypassing type/build tests.

Current Next.js release/security status changes over time; check the official Next.js release/advisory sources before upgrading beyond the version verified by CI.
