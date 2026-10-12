# StockPulse Demo / Reviewer Path

StockPulse has two reviewer paths. The recommended path is **credential-free demo mode**: it exercises the real application, PostgreSQL evidence storage, deterministic change engine, grounding packet, browser-local thesis workflow, and watchlist review state while using clearly labeled synthetic market/evidence fixtures.

## Credential-free demo mode

Requirements:

- Node.js 22 or newer
- PostgreSQL
- no Finnhub key
- no Twelve Data key
- no SEC request or `SEC_USER_AGENT`
- no AI key

Configure `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stockpulse_demo?schema=public"
STOCKPULSE_DEMO_MODE="true"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Prepare and start:

```bash
npm ci
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run demo:seed
npm run dev
```

`npm run demo:seed` is idempotent. It creates the fictional `DEMO` company plus three synthetic filing-like evidence periods and comparable deterministic metrics. Fixture source links use the reserved `example.com` domain and the UI banner states that demo data is synthetic.

### No-network market-data guarantee

When `STOCKPULSE_DEMO_MODE=true`:

- quotes use deterministic local fixtures;
- daily charts use deterministic local fixtures;
- search and company profiles use deterministic local fixtures;
- market/company news uses deterministic local fixtures;
- stored quote/profile/bar rows are bypassed;
- Finnhub requests are blocked even if a Finnhub key is present;
- Twelve Data requests are blocked even if a Twelve Data key is present;
- `/api/ready` reports market provider `demo` and `syntheticDemoData: true`.

This boundary is regression-tested with `fetch` replaced by a function that throws on any network attempt.

## Core evidence-first demo

1. Open `/stocks/DEMO`.
   - The market panel is synthetic.
   - The evidence panel comes from the seeded PostgreSQL fixture.
   - Fixture accession IDs start with `DEMO-`; source links point to `example.com`.

2. Open `/stocks/DEMO/changes`.
   - Show deterministic period-over-period changes for revenue, net income, operating cash flow, and capex.
   - Point out previous/current reporting periods, units, accession IDs, and source links.
   - Emphasize that an increase/decrease is not automatically labeled good or bad.

3. Open `/stocks/DEMO/grounding`.
   - Inspect stable filing, metric, and derived-change evidence IDs.
   - AI is not required to generate or inspect the grounding packet.

4. Open `/research` and create a `DEMO` thesis.
   - Write a falsifiable core thesis.
   - Add assumptions, risks, catalysts, and at least one invalidation criterion.
   - Save it.

5. Refresh evidence in Review State.
   - Add a seeded evidence item to the thesis as `unresolved`.
   - Deliberately classify it as supports, contradicts, qualifies, or unresolved.
   - Mark the current evidence set reviewed.

6. Demonstrate revision history.
   - Edit the thesis and save with a note.
   - Restore an earlier revision into the editor.
   - Saving restored content creates another revision instead of deleting history.

7. Add `DEMO` to the watchlist and open `/watchlist`.
   - Research Changes uses the same stable review checkpoint.

## Optional grounded AI

AI remains optional in demo mode. If a reviewer intentionally configures an AI key/model, the existing grounded-analysis rules still apply: claims and summaries must cite known evidence IDs and recommendation/price-target language is rejected. The synthetic nature of the underlying fixture must remain clear.

## Live integration path

Use live mode only when testing deployment integration:

```env
STOCKPULSE_DEMO_MODE="false"
FINNHUB_API_KEY="..."
TWELVEDATA_API_KEY="..."
SEC_USER_AGENT="StockPulse Research monitored-contact@your-domain.com"
```

Then run real SEC ingestion as needed:

```bash
npm run ingest:sec -- AAPL
```

Before a public live deployment, verify the exact market-data plan, external-display/redistribution rights, exchange requirements, and attribution obligations. Live SEC automation must also use an identifying User-Agent and stay within SEC fair-access limits.

## What not to claim

Do not present demo mode as:

- real-time or historical market data;
- genuine SEC filings for the `DEMO` ticker;
- proof that live provider credentials, contracts, or production networking work;
- an automatic stock picker or BUY/HOLD/SELL recommendation engine.

Demo mode exists to make the **engineering and research workflow reproducible without external credentials or redistribution of third-party market data**.
