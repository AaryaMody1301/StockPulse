# StockPulse: Setup, Verification, and Run Guide

StockPulse is a Next.js stock-market analytics application with market-data provider fallback, PostgreSQL/Prisma storage, background quote/history workers, stock comparison, news, browser-local watchlists, and browser-local portfolio tracking.

The longer-term product upgrade is documented in [`docs/UPGRADE_PLAN.md`](docs/UPGRADE_PLAN.md). Production assumptions and data-source constraints are documented in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## 1. Prerequisites

Install:

1. Node.js 20+ (LTS recommended)
2. npm 10+
3. PostgreSQL 14+
4. Git

Verify:

```powershell
node -v
npm -v
```

## 2. Clone and install

```powershell
git clone <your-repo-url>
cd stock-market
npm install
```

For CI and reproducible production installs, prefer `npm ci` with the checked-in lockfile.

## 3. Market-data providers

The application supports:

1. `FINNHUB_API_KEY` as the primary provider
2. `TWELVEDATA_API_KEY` as a fallback for supported quote/search/history operations

### 3.1 Finnhub

1. Go to `https://finnhub.io/`
2. Create an account and obtain an API key
3. Put the key in `FINNHUB_API_KEY`

Provider plans, quotas, endpoint availability, and usage rights can change. Confirm the endpoints available to the plan actually used by the deployment.

### 3.2 Twelve Data

1. Go to `https://twelvedata.com/`
2. Create an account and obtain an API key
3. Put the key in `TWELVEDATA_API_KEY`

Twelve Data is used as a fallback for supported quote, symbol-search, and daily-history requests. Company-profile and news behavior is intentionally not assumed to be equivalent across providers.

> Public display/redistribution rights depend on the provider plan and market. Review [`docs/OPERATIONS.md`](docs/OPERATIONS.md) before deploying market data publicly.

## 4. Environment configuration

Copy `.env.example` to both `.env.local` and `.env`:

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.example .env
```

The Next.js app reads `.env.local`. The standalone TypeScript workers use `dotenv/config` and read `.env`.

Example:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/stockmarket?schema=public"
FINNHUB_API_KEY="your_finnhub_key"
TWELVEDATA_API_KEY="your_twelvedata_key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
POLL_INTERVAL_MS="15000"
POLL_SYMBOLS="AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM,V,JNJ"
```

Never commit real credentials.

## 5. PostgreSQL and Prisma

Create a database:

```sql
CREATE DATABASE stockmarket;
```

Point `DATABASE_URL` at the real database, then run:

```powershell
npx prisma migrate dev
npx prisma generate
```

For an existing production database, use the checked-in migrations with:

```powershell
npx prisma migrate deploy
```

Optional local inspection:

```powershell
npx prisma studio
```

## 6. Verify the repository

Phase 1 adds one verification gate for application code and workers:

```powershell
npm run check
```

It runs:

1. application TypeScript checking
2. worker TypeScript checking
3. ESLint
4. unit tests

Then verify a production build:

```powershell
npm run build
```

Do not deploy a branch that fails either command.

## 7. Run the website locally

```powershell
npm run dev
```

Open `http://localhost:3000`.

Production-mode local check:

```powershell
npm run build
npm run start
```

## 8. Run data workers

### 8.1 Quote poller

```powershell
npx tsx scripts/poll-quotes.ts
```

The Phase 1 poller:

1. validates and de-duplicates configured symbols on startup
2. runs only one polling cycle at a time
3. upserts snapshots on `(symbolId, timestamp)` so repeated provider timestamps are safe
4. records `success`, `partial`, or `failed` job outcomes
5. records per-symbol failures in job metadata

Finnhub `/quote` does not supply quote volume; Finnhub-backed snapshot volume is currently stored as `0` and explicitly recorded as a limitation in job metadata. Do not build volume analytics from `quote_snapshots` until the source/model is upgraded.

### 8.2 Historical daily backfill

```powershell
npx tsx scripts/backfill-daily.ts
```

The backfill fetches approximately one year of daily OHLCV for active symbols and inserts missing `(symbolId, date)` rows while skipping duplicates.

## 9. API health checks

With the app running:

```powershell
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/quotes?symbols=AAPL,MSFT"
curl "http://localhost:3000/api/stocks/search?q=apple"
curl "http://localhost:3000/api/news?category=general"
```

Expected:

1. `/api/health` returns `status: "ok"`
2. valid data routes return JSON responses
3. malformed ticker lists are rejected with HTTP 400 before provider calls

## 10. Production: current Hostinger/VPS pattern

The repository includes:

1. `ecosystem.config.js` for PM2
2. `deploy/nginx.conf` for the reverse proxy/TLS pattern
3. `server.js` as the production Node entry point

The checked-in deployment configs currently assume the application path is:

```text
/var/www/investsmart
```

Keep that path unless you update **all** deployment configs together.

Typical deployment:

1. Install Node.js, npm, PostgreSQL, Nginx, and PM2.
2. Clone/update the repo at `/var/www/investsmart`.
3. Install dependencies. The current poller runs through `tsx`, so do not omit development dependencies in Phase 1 (`npm ci --include=dev` is explicit and safe).
4. Create production `.env`/`.env.local` values outside version control.
5. Run `npx prisma migrate deploy`.
6. Run `npm run check`.
7. Run `npm run build`.
8. Start/reload PM2 with `ecosystem.config.js`.
9. Configure Nginx from `deploy/nginx.conf` with the real domain/certificate paths.
10. Verify `/api/health`, then verify quote/search/news routes.
11. Save PM2 state and reload Nginx.

The web process intentionally stays at one instance in Phase 1 because the custom cache and rate limiter are process-local. Read [`docs/OPERATIONS.md`](docs/OPERATIONS.md) before scaling horizontally.

## 11. Troubleshooting

### `FINNHUB_API_KEY is not set`

- Confirm the key exists in the environment file used by the process.
- Restart the relevant app/worker after changing environment variables.

### Prisma connection failure

- Recheck `DATABASE_URL`.
- Confirm PostgreSQL is reachable.
- Confirm the database user has the required permissions.

### Website works but worker scripts fail

- Confirm `.env` exists; the workers use `dotenv/config`.
- Confirm production dependencies include `tsx` under the current Phase 1 deployment model.
- Run `npm run typecheck:scripts` before restarting PM2.

### Provider returns quota/error JSON

Phase 1 runtime-validates provider payloads. Invalid provider JSON is treated as an error rather than converted into zero-valued market data; quote/search/history operations can then use the configured fallback where supported.

### Production build fails

- Run `npm run check` first.
- Confirm generated Prisma client setup succeeds.
- Confirm required environment variables are present.
- Run `npx prisma migrate deploy` for production schema changes.

## 12. Security and operational notes

- Never commit `.env` or `.env.local`.
- Rotate leaked API keys immediately.
- Keep database credentials least-privileged.
- Keep the Node process behind the configured reverse proxy.
- Treat external provider responses as untrusted input.
- Verify third-party market-data display/redistribution rights before public production use.
