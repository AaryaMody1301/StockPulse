# StockPulse Operations Notes

This document records production assumptions that are easy to lose when the application is moved between hosts.

## Current deployment shape

Phase 1 assumes:

- Node.js 20.19+; Node 22 is recommended and used by CI;
- one Next.js web process behind Nginx;
- one quote-polling worker;
- PostgreSQL available to the worker;
- Finnhub and Twelve Data credentials supplied through environment variables;
- development/build dependencies are present while Prisma generation/migrations, verification, and the production build run;
- `tsx` is a runtime dependency because the production quote worker executes TypeScript through PM2.

The PM2 configuration intentionally keeps the web process at `instances: 1`.

## Why the web process stays single-instance in Phase 1

`src/lib/cache.ts` and `src/lib/rate-limit.ts` use process-local memory. Running multiple web instances would create independent caches and independent rate-limit counters. Increasing PM2 instances without first moving those concerns to shared storage would therefore produce inconsistent behavior.

Before horizontal scaling, replace or wrap these mechanisms with coordinated shared state (for example Redis or another durable/shared cache) and review Next.js multi-instance cache coordination guidance.

Reference: https://nextjs.org/docs/app/guides/self-hosting

## Reverse proxy

The application expects a trusted reverse proxy such as the checked-in Nginx configuration. Nginx sets `X-Real-IP` and `X-Forwarded-For`; API rate limiting prefers `X-Real-IP` and falls back to the first forwarded address.

Do not expose the Node process directly to the public internet without reviewing proxy/header trust and request limits.

## Quote worker

The quote worker:

- normalizes configured symbols on startup;
- executes one poll cycle at a time;
- schedules the next cycle only after the previous one completes;
- upserts quote snapshots by `(symbolId, timestamp)` so repeated provider timestamps are idempotent;
- records `success`, `partial`, or `failed` based on actual symbol outcomes.

Finnhub's `/quote` payload does not provide volume. The existing `QuoteSnapshot.volume` column is therefore populated with `0` for Finnhub quote snapshots and this limitation is recorded in `JobRun.metadata`. Daily OHLCV history remains the appropriate source for volume-based analysis until the snapshot model/source is upgraded.

## Verification before deployment

Run:

```bash
npm ci
npm run check
npm run build
```

`npm run check` runs application type checking, worker type checking, ESLint, and unit tests. GitHub Actions runs the same gate on Node 22 and then builds the production application.

Do not deploy a branch that fails any of these checks.

## Dependency security status

Phase 1 pins these security-sensitive lines explicitly:

- Next.js `16.3.3`
- React / React DOM `19.2.8`
- Prisma client / PostgreSQL adapter / CLI `7.10.0`
- `tsx` `4.23.9`

The safe production audit refresh also moved `esbuild` and `fast-uri` to patched transitive versions.

`npm audit --omit=dev` still reports three high-severity findings through Prisma's CLI/config dependency on `deepmerge-ts <8` (`GHSA-ggr8-5vv4-36mx`). npm currently proposes resolving that finding with `--force` by downgrading Prisma to `6.12.0`. Phase 1 intentionally does **not** apply that breaking downgrade. The finding is tracked as a known dependency exception and should be re-evaluated when Prisma publishes a compatible dependency update.

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

## Phase 2 data-source direction

Primary-source company evidence will use server-side SEC EDGAR APIs where applicable. SEC `data.sec.gov` provides submissions and XBRL company facts without API keys, but automated access must follow SEC fair-access requirements and the service does not support browser CORS.

Reference: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
