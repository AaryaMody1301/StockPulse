# Contributing to StockPulse

StockPulse treats financial-data correctness, provenance, and failure transparency as first-class requirements. Contributions should preserve those properties rather than only making the UI appear successful.

## Local setup

1. Use Node.js 20.19+.
2. Run `npm ci`.
3. Copy `.env.example` to the appropriate local environment files and use non-production credentials.
4. Apply the schema with `npx prisma migrate deploy --schema=prisma/schema.prisma` when testing database-backed behavior.

Do not commit `.env*` files, provider keys, database credentials, private research exports, or production logs containing secrets.

## Required checks

Before opening a pull request, run:

```bash
npm run check
npm run build
```

For database changes, also verify migrations against a disposable PostgreSQL database. Migrations should be additive unless a breaking migration is explicitly justified and documented.

## Data and research integrity

- Treat provider, SEC, imported, browser-storage, and AI content as untrusted input.
- Normalize and validate ticker symbols at trust boundaries.
- Preserve source provenance for SEC facts, filings, and deterministic calculations.
- Do not silently compare incompatible reporting contexts, units, or time ranges.
- Distinguish unavailable data from numeric zero.
- Partial provider results must remain visibly partial; do not silently drop tracked holdings/watchlist entries or fabricate values.
- Facts, deterministic calculations, and model inferences must remain distinguishable.
- Grounded AI output must cite known evidence IDs and must not become a BUY/HOLD/SELL or price-target engine.

## Provider and licensing changes

Do not assume that an API key grants display, redistribution, real-time, or commercial rights. Provider-plan and exchange-license constraints must be documented as operator requirements when source code cannot enforce them.

## Pull requests

Keep changes focused. Include regression tests for correctness or security fixes and describe any deployment/operator work that cannot be exercised in repository CI.

The CI gate runs PostgreSQL migrations, a production dependency audit, application and script TypeScript checks, ESLint, tests, and a production Next.js build.
