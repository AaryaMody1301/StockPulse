# StockPulse Operations Notes

This document records production assumptions that are easy to lose when the application is moved between hosts.

## Current deployment shape

The current stacked Phase 1 + Phase 2 implementation assumes:

- Node.js 20.19+; Node 22 is recommended and used by CI;
- one Next.js web process behind Nginx;
- one quote-polling worker;
- PostgreSQL available to the web process and workers;
- Finnhub and Twelve Data credentials supplied through environment variables;
- `SEC_USER_AGENT` supplied before SEC ingestion is run;
- development/build dependencies are present while Prisma generation/migrations, verification, and the production build run;
- `tsx` is a runtime dependency because production worker/ingestion commands execute TypeScript directly.

The PM2 configuration intentionally keeps the web process at `instances: 1`.

## Why the web process stays single-instance

`src/lib/cache.ts` and `src/lib/rate-limit.ts` use process-local memory. Running multiple web instances would create independent caches and independent rate-limit counters. Increasing PM2 instances without first moving those concerns to shared storage would therefore produce inconsistent behavior.

Before horizontal scaling, replace or wrap these mechanisms with coordinated shared state and review Next.js multi-instance cache coordination guidance.

Reference: https://nextjs.org/docs/app/guides/self-hosting

## Reverse proxy

The application expects a trusted reverse proxy such as the checked-in Nginx configuration. Nginx sets `X-Real-IP` and `X-Forwarded-For`; API rate limiting prefers `X-Real-IP` and falls back to the first forwarded address.

Do not expose the Node process directly to the public internet without reviewing proxy/header trust and request limits.

## Canonical market-data reads

Phase 2 introduces `src/lib/market/repository.ts` between product routes and external providers.

Current freshness rules are explicit:

- quote snapshots: database-first when no more than 45 seconds old;
- company profiles: database-first when no more than seven days old;
- daily bars: database-first when stored coverage reaches the requested range within a seven-day market-calendar tolerance.

When stored data is missing or stale, the repository calls the existing provider service and performs best-effort persistence. If a provider request fails, stale stored quote/profile data or partial stored daily history may be returned rather than turning a temporary provider outage into a blank product.

This is intentionally a read-through repository, not a claim that every stored value has identical semantics. Provider source/timestamp meaning must remain explicit as the data model evolves.

## Quote worker

The quote worker:

- normalizes configured symbols on startup;
- executes one poll cycle at a time;
- schedules the next cycle only after the previous one completes;
- upserts quote snapshots by `(symbolId, timestamp)` so repeated provider timestamps are idempotent;
- records `success`, `partial`, or `failed` based on actual symbol outcomes.

Finnhub's `/quote` payload does not provide volume. The existing `QuoteSnapshot.volume` column is therefore populated with `0` for Finnhub quote snapshots and this limitation is recorded in `JobRun.metadata`. Daily OHLCV history remains the appropriate source for volume-based analysis until the snapshot model/source is upgraded.

## SEC EDGAR evidence ingestion

Phase 2 uses the SEC's public EDGAR data APIs server-side. The SEC states that `data.sec.gov` requires no API key, provides submissions/companyfacts JSON, and does not support browser CORS. Automated access is subject to SEC fair-access rules, currently no more than 10 requests per second.

References:

- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/about/developer-resources
- https://www.sec.gov/about/privacy-information

### Required identity

Set a descriptive, monitored user agent before making SEC requests:

```env
SEC_USER_AGENT="StockPulse Research contact@example.com"
```

The SEC client refuses automated requests when this variable is absent. It serializes requests with a minimum 150 ms gap (roughly 6.7 requests/second), deliberately below the SEC ceiling.

### Database migration

Apply checked-in migrations before ingestion:

```bash
npx prisma migrate deploy
```

The Phase 2 migration is additive: `symbols.cik`, `sec_filings`, `sec_facts`, and `sec_metrics` are added without removing or rewriting existing market tables.

### Ingest evidence

Examples:

```bash
npm run ingest:sec -- AAPL
npm run ingest:sec -- AAPL MSFT NVDA
```

The ingestion path:

1. resolves ticker -> CIK using the SEC company ticker mapping;
2. fetches current submissions and companyfacts;
3. stores selected research-relevant filings with accession/source URLs;
4. stores selected XBRL facts with filing/taxonomy provenance;
5. deterministically maps a small first metric set (revenue, net income, EPS, cash, debt where a reliable total concept exists, shares, operating cash flow, and capex);
6. records `success`, `partial`, or `failed` in `job_runs`;
7. uses deterministic fact/metric keys and unique accession numbers so re-running ingestion is idempotent.

The normalized concept map lives in `src/lib/sec/normalization.ts`. A missing concept is treated as unavailable data; it is not guessed or synthesized.

### Read evidence

Stored evidence is available at:

```text
GET /api/stocks/{symbol}/evidence
```

The stock detail server component also reads the same stored evidence directly. If live market providers fail, stored SEC evidence can still render independently.

## Verification before deployment

Run:

```bash
npm ci
npm run check
npm run build
```

`npm run check` runs application type checking, worker/CLI type checking, ESLint, and unit tests. GitHub Actions runs the same gate on Node 22 and then builds the production application.

Do not deploy a branch that fails any of these checks.

For Phase 2, also test the migration and one credentialed SEC ingestion against a disposable/staging PostgreSQL database before production deployment.

## Dependency security status

Phase 1 pins these security-sensitive lines explicitly:

- Next.js `16.3.3`
- React / React DOM `19.2.8`
- Prisma client / PostgreSQL adapter / CLI `7.10.0`
- `tsx` `4.23.9`

The safe production audit refresh also moved `esbuild` and `fast-uri` to patched transitive versions.

`npm audit --omit=dev` still reports three high-severity findings through Prisma's CLI/config dependency on `deepmerge-ts <8` (`GHSA-ggr8-5vv4-36mx`). npm currently proposes resolving that finding with `--force` by downgrading Prisma to `6.12.0`. Do **not** apply that breaking downgrade automatically; re-evaluate the exception when Prisma publishes a compatible dependency update.

Do not use `npm audit fix --force` as an automated deployment step.

## Market-data usage and licensing

Third-party market-data rights depend on the actual provider plan and intended use. Do not assume that an educational/free/individual subscription automatically permits public display or redistribution.

Twelve Data currently documents individual plans as personal/internal-use plans and says redistribution/commercial display requires the appropriate business/licensing arrangement.

Reference: https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage

Before public production launch:

1. record the actual provider plan in private deployment documentation;
2. verify whether public display is permitted for the selected markets/data;
3. add any required attribution;
4. avoid exposing raw provider credentials or unrestricted proxy endpoints.
