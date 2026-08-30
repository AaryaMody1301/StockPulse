# StockPulse Demo / Reviewer Path

This path demonstrates the differentiated workflow without relying on an AI model.

## Preparation

1. Configure PostgreSQL and apply migrations.
2. Configure at least one market-data provider used by the target environment.
3. Configure a real `SEC_USER_AGENT`.
4. Ingest a company with useful stored history, for example:

```bash
npm run ingest:sec -- AAPL
```

5. Start the application.

Optional: configure `AI_GATEWAY_API_KEY` (or `AI_API_KEY`) and `AI_MODEL` to demonstrate grounded synthesis. AI is not required for the main flow.

## Core evidence-first demo

1. Open `/stocks/AAPL`.
   - Show current/cached market information.
   - Show the SEC Evidence panel with filing and XBRL provenance.

2. Open `/stocks/AAPL/changes`.
   - Show deterministic period-over-period metric changes.
   - Point out current/previous periods, accession number, taxonomy/concept, and source link.
   - Emphasize that an increase/decrease is not automatically called good or bad.

3. Open `/research` and create an AAPL thesis.
   - Write a falsifiable core thesis.
   - Add assumptions, risks, and at least one invalidation criterion.
   - Save it.

4. In the Review State panel, refresh evidence.
   - New grounding evidence IDs appear because this thesis has never been reviewed.
   - Add one SEC evidence item to the thesis. It enters as `unresolved`.
   - Classify it deliberately as supports/contradicts/qualifies/unresolved and save.

5. Click “Mark current evidence reviewed.”
   - This records the current stable evidence-ID set in IndexedDB.
   - Refreshing again should show no pending evidence unless server evidence changed.

6. Demonstrate thesis revision history.
   - Change the thesis, save it with a note, then restore the earlier revision into the editor.
   - Saving the restored state creates another revision rather than destroying history.

7. Add AAPL to the watchlist and open `/watchlist`.
   - The Research Changes section uses the same local review checkpoint for watched companies with saved theses.

## Change-detection replay demo

To demonstrate a newly detected review item without waiting for a future filing, use a disposable/staging database and ingest a later fixture/filing dataset after marking the current evidence reviewed. The desired behavior is:

```text
old evidence IDs reviewed
        +
newly stored filing/fact/change evidence
        ↓
review delta contains only new IDs
        ↓
watchlist + thesis review surface the pending evidence
```

Re-running the same ingestion should not create duplicate filing/fact/metric records.

## Optional grounded AI demo

With server AI configuration enabled:

1. Open `/stocks/AAPL/grounding`.
2. Inspect the evidence IDs first.
3. Click “Generate analysis.”
4. Show that every returned claim is labeled `Fact`, `Derived`, or `Inference` and displays evidence IDs.
5. Return to `/research` and click “Challenge thesis.”
   - The UI explicitly states that this action sends the current thesis draft plus the bounded grounding packet to the configured endpoint.
   - The model cannot add arbitrary citations: unknown evidence IDs fail server validation.

Then unset the AI key/model and repeat the deterministic pages to show that the core workflow still operates without AI.

## Failure / trust-boundary demo

Useful engineering checks:

- malformed symbols are rejected before provider calls;
- unsafe provider URLs fail runtime validation;
- malformed browser storage is ignored instead of trusted;
- malformed thesis imports are rejected;
- invented grounding citations are rejected by tests/runtime validation;
- AI provider failure leaves deterministic evidence available;
- duplicate SEC ingestion produces zero duplicate inserts for unique records.

## What not to claim

Do not present StockPulse as:

- a full-market real-time terminal;
- an automatic stock picker;
- a BUY/HOLD/SELL recommendation engine;
- proof that every data-provider subscription permits public redistribution;
- proof that production credentials/networking work merely because repository CI is green.
