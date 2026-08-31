import assert from "node:assert/strict";
import test from "node:test";
import type { GroundingBundle } from "../src/lib/ai/grounding";
import { parseGroundedModelContent } from "../src/lib/ai/provider";

const evidenceId = "metric:revenue:2026-06-30:test";
const bundle: GroundingBundle = {
  format: "stockpulse-grounding",
  version: 1,
  symbol: "AAPL",
  companyName: "Apple Inc.",
  generatedAt: "2026-08-30T00:00:00.000Z",
  instructions: ["Use only known evidence IDs."],
  evidence: [{
    id: evidenceId,
    kind: "metric",
    label: "Revenue",
    sourceUrl: "https://www.sec.gov/example",
    accessionNumbers: ["test"],
    details: { value: "100", unit: "USD" },
  }],
};

test("AI provider content must be strict JSON and cite the grounding bundle", () => {
  const parsed = parseGroundedModelContent(JSON.stringify({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "The stored revenue fact is available.",
    summaryEvidenceIds: [evidenceId],
    claims: [{
      type: "Fact",
      text: "Stored revenue is 100 USD.",
      evidenceIds: [evidenceId],
    }],
    uncertainties: [],
  }), bundle);
  assert.equal(parsed.claims.length, 1);
  assert.equal(parsed.summaryEvidenceIds[0], evidenceId);

  assert.throws(() => parseGroundedModelContent("```json\n{}\n```", bundle), /non-JSON/);
  assert.throws(() => parseGroundedModelContent(JSON.stringify({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "Unsupported.",
    summaryEvidenceIds: ["invented"],
    claims: [{
      type: "Fact",
      text: "Stored revenue is 100 USD.",
      evidenceIds: [evidenceId],
    }],
    uncertainties: [],
  }), bundle), /unknown evidence IDs/);
});
