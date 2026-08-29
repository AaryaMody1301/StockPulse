# StockPulse Upgrade Plan

This roadmap evolves the existing application from a market dashboard into an evidence-first investment research and thesis-monitoring system without breaking the current stock, news, comparison, watchlist, or portfolio flows.

## Product direction

StockPulse should answer a narrower and more defensible question than a generic stock terminal:

> What changed since I last reviewed this company, does it affect my investment thesis, and what primary-source evidence proves it?

The current dashboard remains useful as the entry surface. The differentiation is added through a canonical data layer, primary-source evidence, durable theses, and change detection.

---

## Phase 1 — Foundation hardening

**Goal:** make the current application truthful, testable, and operationally safer before changing its architecture.

### Scope

- Centralize and enforce ticker validation at API and provider boundaries.
- Runtime-validate external market-provider JSON before it becomes application state.
- Make malformed/quota/error payloads fail cleanly so provider fallback can run.
- Make quote polling non-overlapping and idempotent for repeated provider timestamps.
- Record worker runs as `success`, `partial`, or `failed` based on actual outcomes.
- Make curated-universe labels explicit instead of presenting ten symbols as the whole market.
- Align the PM2 web entry point with `npm start` / `server.js`.
- Add type-check, lint, unit-test, and production-build verification commands.
- Add GitHub Actions CI.
- Document current data-source/licensing assumptions and the single-process cache/rate-limit constraint.
- Preserve all existing user-facing routes and browser-local watchlist/portfolio behavior.

### Explicit non-goals

- No authentication migration.
- No portfolio schema rewrite.
- No AI stock recommendations.
- No redesign.
- No SEC ingestion yet.
- No rename/rebrand yet; choose the final identity after the product direction is proven.

### Exit criteria

- `npm run check` passes.
- `npm run build` passes.
- Invalid symbols are rejected before provider calls.
- Provider error JSON cannot silently become zero-valued quote/history data.
- Poll cycles cannot overlap.
- Repeated quote timestamps do not cause unique-constraint failures.
- Partial polling failures are observable as partial runs.
- Existing home, stock detail, news, compare, watchlist, and portfolio routes remain intact.

---

## Phase 2 — Canonical data layer + SEC evidence

**Goal:** make PostgreSQL useful to the product and establish primary-source financial evidence.

### Scope

- Introduce a canonical market-data repository/service between UI routes and providers.
- Read stored quote snapshots and daily bars where appropriate instead of always refetching providers.
- Define freshness rules and provider fallback behavior explicitly.
- Add SEC ticker/CIK mapping.
- Add server-side SEC `submissions` ingestion for filing history.
- Add SEC `companyfacts` ingestion for normalized XBRL facts.
- Store filing provenance: accession number, form, filing date, report date, source URL, ingestion timestamp.
- Add deterministic normalized metrics for an intentionally small first set: revenue, net income, EPS, cash, debt, shares, operating cash flow, and capex where source concepts are reliable.
- Add ingestion checkpoints, retries, idempotency, and job observability.
- Add read APIs for filing timelines and financial facts.
- Add a basic evidence/timeline section to the existing stock detail page.

### Data-source rules

- SEC evidence is first-party and server-side.
- Every normalized fact retains enough provenance to locate its filing/source context.
- Provider data and SEC facts are not silently mixed when their timestamps or meanings differ.
- Public deployment of third-party market data remains gated on the actual subscription/licensing rights in use.

### Exit criteria

- A supported stock can be mapped from ticker to CIK.
- New SEC filings can be ingested idempotently.
- Key financial facts can be traced to SEC source metadata.
- Stock detail pages can render stored evidence even if a market-data provider is temporarily unavailable.

---

## Phase 3 — Thesis workspace

**Goal:** give research persistent memory instead of adding another generic watchlist.

### Scope

- Introduce durable research entities: thesis, assumptions, risks, catalysts, falsification criteria, review state, and evidence links.
- Separate factual evidence from user-authored interpretation.
- Add `supports`, `contradicts`, `qualifies`, and `unresolved` evidence relationships.
- Add a review timeline showing how a thesis changes over time.
- Add explicit “What would change my mind?” criteria.
- Add import/export before requiring users to trust the system with irreplaceable research.
- Decide and implement the smallest sustainable identity/sync model only when server-side user persistence is needed.
- Keep the existing watchlist/portfolio usable during migration; provide a reversible migration path from browser-local data.

### Exit criteria

- A user can create a thesis for a company and preserve its revision history.
- Assumptions and falsification criteria can be linked to evidence.
- Evidence is never presented as the user's conclusion automatically.
- Existing browser-local data is not silently discarded.

---

## Phase 4 — Change intelligence

**Goal:** detect material changes and connect them to the user's saved thesis.

### Scope

- Detect newly filed 10-K, 10-Q, and material 8-K events for followed companies.
- Compute deterministic period-over-period metric changes.
- Build “since your last review” state using stored review checkpoints.
- Surface changed facts before summaries.
- Connect new evidence to existing assumptions as candidate support/contradiction/qualification, requiring clear provenance.
- Add thesis-health and research-debt views without reducing the result to a BUY/HOLD/SELL score.
- Add watchlist-level change digest and event prioritization.
- Add benchmarked tests for change detection and false-positive behavior.

### Exit criteria

- A seeded new filing produces a deterministic list of changed facts.
- Each surfaced change has source provenance.
- The system can explain why a change may matter to a stored thesis without issuing an investment recommendation.
- Re-running the same ingestion produces the same research state.

---

## Phase 5 — Grounded AI + release experience

**Goal:** add optional AI only after the deterministic evidence system is reliable.

### Scope

- Add source-grounded synthesis over stored evidence and thesis state.
- Label outputs as `Fact`, `Derived`, or `Inference`.
- Require citations/provenance for factual AI claims.
- Add “challenge my thesis” and counterargument workflows.
- Add bounded context, prompt-injection handling for untrusted text, timeouts, cancellation, and model-output validation.
- Keep deterministic evidence available when AI is unavailable.
- Do not generate automatic BUY/HOLD/SELL verdicts or pretend uncertainty is certainty.
- Finalize product name/branding after the differentiated workflow is proven.
- Upgrade README, architecture docs, screenshots, seeded demo data, demo script, and judge/reviewer path.

### Exit criteria

- AI can be disabled without breaking the core research workflow.
- Every factual AI statement in the main research experience is traceable to evidence.
- A complete demo shows: saved thesis -> new filing -> detected changes -> evidence -> thesis impact -> user review.

---

## Cross-phase engineering rules

1. Existing functionality is preserved unless a replacement is shipped and migration is explicit.
2. Each phase lands behind tests and a reviewable pull request.
3. Schema changes are additive first; destructive migrations require a separate migration plan.
4. External responses are untrusted input and require runtime validation.
5. First-party source evidence is preferred for factual financial claims.
6. Financial analysis must distinguish source facts, deterministic calculations, and inference.
7. Data licensing is treated as an architecture constraint, not a footer-only concern.
8. Product claims must match the actual data universe and freshness available.

## Reference constraints reviewed in 2026

- SEC EDGAR data APIs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Next.js self-hosting guidance: https://nextjs.org/docs/app/guides/self-hosting
- Twelve Data commercial/personal usage: https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage
