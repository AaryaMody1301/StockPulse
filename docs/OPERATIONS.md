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

## Liveness and readiness

`GET /api/health` is intentionally a lightweight liveness probe. It only proves that the web process can respond.

`GET /api/ready` is the deployment readiness probe. It returns `200` only when:

- `DATABASE_URL` is configured and PostgreSQL responds to a lightweight query; and
- at least one supported market-data provider key is configured.

The readiness response also reports whether SEC ingestion identity, optional AI, and the canonical app URL are configured, but those checks do not block web readiness. Secret values are never returned.

Database readiness is cached in-process for five seconds so frequent load-balancer probes do not create an unnecessary query per request.

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
- daily bars: database-first only when stored history covers the requested start region and reaches the latest **completed** U.S. market session required by the request.

Daily history uses the market calendar rather than a fixed end-date tolerance. Before a trading-day close, the prior completed session is the expected endpoint; after the close, that day can become required. Weekends, NYSE holidays, and published early-close sessions are handled explicitly. This prevents several missing trading sessions from being hidden inside a broad calendar-day tolerance.

Provider reads refill PostgreSQL best-effort. Provider failure may fall back to stale stored quote/profile data or partial stored daily history. Homepage, stock detail, quote API, and comparison history all use this canonical boundary.

Do not assume values from different providers have identical timestamps, market coverage, or redistribution rights.

## Quote worker

The quote worker:

- normalizes/de-duplicates configured symbols;
- permits only one poll cycle at a time;
- upserts repeated `(symbolId, timestamp)` snapshots;
- records `success`, `partial`, or `failed` based on actual symbol outcomes.

Finnhub `/quote` does not supply volume. Finnhub-backed snapshot volume is therefore `0`; do not build snapshot-volume analytics from that field. Daily OHLCV history is the appropriate existing volume source.

Finnhub recommends streaming rather than constant `/quote` polling for real-time use. The current worker is intentionally an operator-controlled polling implementation; its cadence must remain within the active provider plan and quota.

## SEC EDGAR ingestion

StockPulse uses the public SEC submissions and companyfacts APIs server-side. The data APIs require no API key, but automated access must identify the client and comply with SEC fair-access policy.

References:

- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data

### Identity and request control

Configure a real monitored identity. Do not leave the `.env.example` placeholder in production:

```env
SEC_USER_AGENT="StockPulse Research ops@your-real-domain.com"
```

The SEC client refuses requests without this variable. `/api/ready` also treats reserved `.example` contact domains as placeholder configuration.

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
- duplicate/amended observations for the same reporting context select the latest filing deterministically;
- instant facts compare by reporting date;
- duration facts compare only when reporting durations are compatible;
- quarter-only facts are preferred over YTD observations when both share the latest end date;
- cross-unit values are never compared;
- a zero prior value produces an absolute delta but no misleading percentage.

The browser-local thesis model stores `lastReviewedAt` plus the stable grounding evidence IDs that were reviewed. “Since last review” is calculated from ID set differences, not from client clock guesses.

The watchlist research digest applies the same calculation to watched companies with saved theses.

## Browser-local data

Theses use IndexedDB. Watchlist and portfolio data use localStorage.

All browser-stored records are runtime-validated before becoming application state. Legacy `investsmart-watchlist` and `investsmart-portfolio` values are copied to `stockpulse-*` keys only after validation, so existing users are migrated without trusting arbitrary local JSON.

Partial market-data responses preserve tracked watchlist symbols and last-known quotes where available. Portfolio holdings with unavailable current prices remain holdings with known cost basis; they are excluded from quoted valuation/P&L rather than being converted to zero-value losses.

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
5. summaries and individual claims must cite known evidence IDs;
6. unknown citations or recommendation/positioning/price-target language are rejected before display;
7. failures leave deterministic evidence pages usable.

“Challenge my thesis” uploads the current browser draft only after an explicit button press. Opening or editing the research workspace alone does not send thesis text to an AI provider.

## Database migrations and CI

Production migration:

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
```

GitHub Actions starts PostgreSQL 16, installs dependencies, runs the high-severity production dependency audit, applies every checked-in migration, runs an SEC idempotency database test, then runs:

```bash
npm run check
npm run build
```

Do not deploy a branch that fails this gate.

The CI database proves migration SQL and basic Prisma/PostgreSQL behavior on a clean disposable database. It does **not** prove target-environment networking, permissions, production data volume, backup/restore behavior, or upgrade behavior for every possible historical production state.

## Deployment smoke checks

After deployment and before public traffic:

1. verify `/api/health` returns `200`;
2. verify `/api/ready` returns `200` and reports the expected configured providers;
3. verify quote/search/news with real provider credentials;
4. verify a stock detail page and comparison route;
5. run one identified SEC ingestion against staging/production PostgreSQL;
6. confirm stored evidence and `/stocks/{symbol}/changes` render;
7. create a local thesis, mark evidence reviewed, and verify the review digest;
8. if AI is configured, run one grounded summary and one challenge-thesis request, then confirm summaries/claims render known evidence IDs;
9. test through the actual reverse proxy, not only localhost;
10. test process restart and database backup/restore procedures.

## Market-data licensing

Provider plan and market-data rights are an architecture constraint. Do not assume a free/personal plan permits public display or redistribution.

Before public launch, record the actual provider plan privately, verify public display/redistribution rights for each market/data type, add required attribution, and avoid exposing provider credentials or unrestricted proxy endpoints.

In particular, current Twelve Data guidance distinguishes individual/internal-use plans from business/display/redistribution rights and states that external display/redistribution can require business plans, exchange permissions, add-ons, and attribution. Re-check the provider’s current contractual terms before launch because these policies can change independently of this repository.

## Repository governance

The source tree includes `CONTRIBUTING.md` and `SECURITY.md`. The repository intentionally does **not** invent an open-source license: if no `LICENSE` file exists, the owner must make that legal choice explicitly.

CI should be required on `main` through GitHub branch protection or a ruleset. If repository settings do not enforce that, direct pushes can bypass the otherwise-strong workflow gate.

## Dependency/security maintenance

Framework/runtime versions are pinned tightly for security-sensitive packages. Do not use `npm audit fix --force` automatically on production code.

Re-run dependency audit and review upstream advisories during release maintenance. A dependency warning that requires a major or breaking downgrade should be evaluated deliberately rather than bypassing type/build tests.

Current Next.js release/security status changes over time; check the official Next.js release/advisory sources before upgrading beyond the version verified by CI.
