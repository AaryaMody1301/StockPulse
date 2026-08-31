import assert from "node:assert/strict";
import test from "node:test";
import type { GroundingBundle } from "../src/lib/ai/grounding";
import { parseGroundedModelContent } from "../src/lib/ai/provider";

const bundle: GroundingBundle = {
  format: "stockpulse-grounding",
  version: 1,
  symbol: "AAPL",
  companyName: "Apple Inc.",
  generatedAt: "2026-08-30T00:00:00.000Z",
  instructions: ["Use only known evidence IDs."],
  evidence: [{
    id: "metric:revenue:2026-06-30:test",
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
    claims: [{
      type: "Fact",
      text: "Stored revenue is 100 USD.",
      evidenceIds: ["metric:revenue:2026-06-30:test"],
    }],
    uncertainties: [],
  }), bundle);
  assert.equal(parsed.claims.length, 1);

  assert.throws(() => parseGroundedModelContent("```json\n{}\n```", bundle), /non-JSON/);
  assert.throws(() => parseGroundedModelContent(JSON.stringify({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "Unsupported.",
    claims: [{
      type: "Fact",
      text: "Invented fact.",
      evidenceIds: ["invented"],
    }],
    uncertainties: [],
  }), bundle), /unknown evidence IDs/);
});
