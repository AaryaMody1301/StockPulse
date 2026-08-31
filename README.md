# StockPulse

StockPulse is an evidence-first investment research application built with Next.js, PostgreSQL/Prisma, SEC EDGAR data, and optional grounded AI.

Its core question is:

> What changed since I last reviewed this company, does the evidence affect my thesis, and where did that evidence come from?

StockPulse is a research tool, not a BUY/HOLD/SELL engine and not personalized investment advice.

## What is included

- Curated market dashboard with provider fallback and a canonical database-first read layer.
- Stock detail pages with price history, company information, news, and stored SEC evidence.
- SEC ticker-to-CIK resolution, filing ingestion, normalized XBRL metrics, bounded retries, and continuation-history support.
- Deterministic period-over-period change detection with accession/concept provenance and reporting-period compatibility checks.
- Browser-local watchlists and portfolios with validated legacy-data migration and safe partial-quote behavior.
- Browser-local thesis workspace with assumptions, risks, catalysts, invalidation criteria, revision restore, and evidence relationships.
- Stable evidence-review checkpoints and “new since last review” research state.
- Watchlist-level research digest for companies with saved theses.
- Versioned grounding packets that label source facts separately from deterministic calculations.
- Optional server-configured AI analysis and “challenge my thesis” workflows. Returned summaries and claims must cite known grounding evidence IDs and pass runtime validation before display.
- GitHub Actions verification with PostgreSQL migration deployment, TypeScript, ESLint, unit/integration tests, and a production Next.js build.
- Separate liveness (`/api/health`) and dependency/configuration readiness (`/api/ready`) probes.

## Stack

- Next.js 16 / React 19 / TypeScript
- PostgreSQL + Prisma
- Zod runtime validation
- Finnhub primary market-data integration with Twelve Data fallback where supported
- SEC EDGAR submissions + companyfacts APIs
- IndexedDB for thesis research; localStorage for watchlist/portfolio
- Optional OpenAI-compatible AI endpoint; Vercel AI Gateway is the default base URL when configured

## Requirements

- Node.js 20.19+; Node 22 is used in CI
- npm
- PostgreSQL for persistent market/SEC data
- At least one supported market-data API key for live market-data provider reads
- A descriptive `SEC_USER_AGENT` before automated SEC ingestion

## Setup

```bash
git clone https://github.com/AaryaMody1301/StockPulse.git
cd StockPulse
npm ci
cp .env.example .env.local
cp .env.example .env
```

Configure the environment files without committing credentials. The Next.js app reads normal Next.js environment files; standalone scripts load `.env` through `dotenv/config`.

Apply the database schema:

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
```

For local development:

```bash
npm run dev
```

For a production-mode check:

```bash
npm run check
npm run build
npm start
```

## Environment variables

See `.env.example` for the full template.

Required by the relevant feature:

- `DATABASE_URL` — PostgreSQL connection string.
- `FINNHUB_API_KEY` — primary market-data provider key.
- `TWELVEDATA_API_KEY` — optional fallback key for supported operations.
- `SEC_USER_AGENT` — descriptive application/company name plus monitored contact for automated EDGAR access.
- `NEXT_PUBLIC_APP_URL` — canonical public application origin used by metadata, sitemap, and robots output.

Optional grounded AI is **disabled unless both a key and model are configured**:

- `AI_GATEWAY_API_KEY` or `AI_API_KEY`
- `AI_MODEL`
- `AI_BASE_URL` — defaults to `https://ai-gateway.vercel.sh/v1`; may point to another trusted OpenAI-compatible endpoint.

API keys stay server-side. StockPulse never stores model-provider credentials in browser research storage.

## SEC ingestion

Ingest one or more tickers:

```bash
npm run ingest:sec -- AAPL
npm run ingest:sec -- AAPL MSFT NVDA
```

The ingestion path:

1. resolves ticker identity through the SEC ticker map;
2. fetches current submissions and companyfacts;
3. serializes SEC requests below the documented fair-access ceiling;
4. retries bounded 429/5xx/network-timeout failures and honors bounded `Retry-After` delays;
5. reads referenced continuation submission files when the recent research-relevant history is thin;
6. filters supported research forms and stores filing provenance;
7. deterministically maps a deliberately small metric set;
8. inserts facts/metrics/filings idempotently;
9. records `success`, `partial`, or `failed` job outcomes.

Current normalized metrics include revenue, net income, EPS, cash, long-term debt where a supported source concept exists, shares outstanding, operating cash flow, and capex. Missing source concepts remain missing; StockPulse does not invent them.

## Research workflow

1. Open a company and inspect stored SEC evidence and deterministic changes.
2. Create or open a thesis under `/research`.
3. Record assumptions, risks, catalysts, and concrete invalidation criteria.
4. Add evidence manually or import a stored SEC evidence item as an **unresolved** thesis relationship.
5. Classify evidence as `supports`, `contradicts`, `qualifies`, or `unresolved`.
6. Mark the current grounding evidence set reviewed.
7. Later, StockPulse compares stable evidence IDs and surfaces newly stored evidence since that checkpoint.
8. Restore an earlier thesis revision into the editor when needed, then save it as a new revision.
9. Export important browser-local research regularly.

The watchlist digest uses the same local review checkpoints for watched companies that have saved theses.

## Optional grounded AI

AI is an optional layer over deterministic evidence; it is not required for core research.

The server builds a bounded `stockpulse-grounding` packet containing stored SEC filings, normalized facts, and deterministic changes. A model response must match the strict `stockpulse-grounded-analysis` contract:

- summaries and claims cite evidence IDs present in the packet;
- claims are labeled `Fact`, `Derived`, or `Inference`;
- invented evidence IDs are rejected;
- unexpected output fields are rejected;
- recommendation/positioning language such as BUY/HOLD/SELL, allocation instructions, or price targets is rejected;
- provider/model failures leave deterministic evidence usable.

“Challenge my thesis” sends the current thesis only after an explicit user action; normal browser-local research is not silently uploaded to an AI endpoint.

## Workers

Quote polling:

```bash
npx tsx scripts/poll-quotes.ts
```

Historical daily backfill:

```bash
npx tsx scripts/backfill-daily.ts
```

The quote poller is non-overlapping, idempotent for repeated provider timestamps, and records partial failures. Finnhub `/quote` does not supply volume; Finnhub-backed quote-snapshot volume remains `0` and should not be used as a reliable volume signal.

## Verification

```bash
npm run check
npm run build
```

`npm run check` runs application TypeScript checking, worker/CLI TypeScript checking, ESLint, and tests.

CI additionally starts PostgreSQL, applies all checked-in migrations with `prisma migrate deploy`, verifies an idempotent SEC database write, runs the production-only high-severity dependency audit, and then runs the production build.

Historical daily-cache completeness is evaluated against completed U.S. market sessions rather than a fixed calendar-day tolerance, so weekends, exchange holidays, normal closes, and published early closes do not silently mask stale history.

## Main routes

- `/` — curated market dashboard
- `/stocks/[symbol]` — company detail + SEC evidence
- `/stocks/[symbol]/changes` — deterministic metric changes
- `/stocks/[symbol]/grounding` — bounded grounding packet + optional AI analysis
- `/research` — local thesis and review workspace
- `/watchlist` — tracked symbols + research-change digest
- `/portfolio` — browser-local holdings and P&L
- `/compare` — canonical daily-history comparison
- `/news` — provider-backed market/company news
- `/api/health` — liveness probe; confirms the web process can respond
- `/api/ready` — readiness probe; checks PostgreSQL reachability and market-provider configuration while reporting optional SEC/AI/app-URL configuration without exposing secrets

## Deployment

The repository includes:

- `server.js` for Node/Hostinger-style startup;
- `ecosystem.config.js` for PM2 web + quote-poller processes;
- `deploy/nginx.conf` as a reverse-proxy/TLS example.

PM2 uses the current repository directory by default. Set `STOCKPULSE_APP_DIR` if the processes should run from another path.

Before production deployment:

1. configure environment variables outside version control;
2. run `npm ci`;
3. run `npx prisma migrate deploy`;
4. run `npm run check` and `npm run build`;
5. verify `/api/health` returns 200 and `/api/ready` returns 200 in the deployed environment;
6. smoke-test credentialed market-provider routes;
7. perform an identified live SEC ingestion with the real `SEC_USER_AGENT`;
8. verify actual data-provider display/redistribution rights and required attribution for the plan and markets in use;
9. verify TLS, reverse-proxy headers, process supervision/restart behavior, and database backup/restore.

Operational constraints and security notes are in [`docs/OPERATIONS.md`](docs/OPERATIONS.md). The implementation history and product principles remain in [`docs/UPGRADE_PLAN.md`](docs/UPGRADE_PLAN.md).

## Privacy and safety boundaries

- Thesis research stays in IndexedDB unless the user exports it or explicitly invokes an AI workflow.
- Watchlist/portfolio records are browser-local and runtime-validated before becoming application state.
- External provider/SEC responses are treated as untrusted input.
- Evidence content is data, not executable model instructions.
- No browser storage contains provider API credentials.
- StockPulse does not issue automatic investment recommendations or price targets.

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the required local/CI checks and evidence-integrity conventions. Security reports should follow [`SECURITY.md`](SECURITY.md); never post real API keys, database URLs, private thesis exports, or exploit details in a public issue.

## Known operator responsibilities

The repository can test schemas, migrations, provider parsers, deterministic calculations, dependency gates, readiness logic, and production builds without production credentials. It cannot prove private provider subscription entitlements, production PostgreSQL networking/backups, reverse-proxy/TLS configuration, or real credentialed provider/SEC behavior. Run those deployment smoke checks in the target environment before public release.

Provider licensing is an operational release gate, not something source code can grant. Public display/redistribution must comply with the market-data plan, exchange requirements, and any required attribution.

## License status

No open-source license has been selected for this repository. Until the owner adds a `LICENSE` file, reuse is governed by the default copyright rules that apply to an unlicensed repository. A license should be chosen deliberately based on the owner’s intended reuse and distribution terms rather than inferred by application code.
