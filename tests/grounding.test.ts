import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGroundingBundle,
  validateGroundedAnalysis,
} from "../src/lib/ai/grounding";
import type { StoredMetricChanges } from "../src/lib/change-intelligence/repository";
import type { StoredSecEvidence } from "../src/lib/sec/repository";

const evidence: StoredSecEvidence = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  cik: "0000320193",
  filings: [
    {
      accessionNumber: "0000320193-26-000001",
      form: "10-Q",
      filedAt: "2026-07-31",
      reportDate: "2026-06-30",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/example.htm",
    },
  ],
  metrics: [
    {
      metric: "revenue",
      value: "100",
      unit: "USD",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filedAt: "2026-07-31",
      accessionNumber: "0000320193-26-000001",
      form: "10-Q",
      taxonomy: "us-gaap",
      concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
    },
  ],
};

const changes: StoredMetricChanges = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  generatedAt: "2026-08-30T00:00:00.000Z",
  changes: [
    {
      metric: "revenue",
      unit: "USD",
      current: {
        metric: "revenue",
        value: "100",
        unit: "USD",
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        filedAt: "2026-07-31",
        accessionNumber: "0000320193-26-000001",
        form: "10-Q",
        taxonomy: "us-gaap",
        concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
        sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/example.htm",
      },
      previous: {
        metric: "revenue",
        value: "80",
        unit: "USD",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        filedAt: "2026-05-01",
        accessionNumber: "0000320193-26-000000",
        form: "10-Q",
        taxonomy: "us-gaap",
        concept: "RevenueFromContractWithCustomerExcludingAssessedTax",
        sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/previous.htm",
      },
      absoluteChange: 20,
      percentChange: 25,
      direction: "increase",
    },
  ],
};

test("grounding bundle uses stable evidence IDs for facts and derived changes", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  assert.equal(bundle.format, "stockpulse-grounding");
  assert.equal(bundle.version, 1);
  assert.ok(bundle.evidence.some((item) => item.id === "filing:0000320193-26-000001"));
  assert.ok(bundle.evidence.some((item) => item.id === "metric:revenue:2026-06-30:0000320193-26-000001"));
  assert.ok(bundle.evidence.some((item) => item.id.startsWith("change:revenue:2026-06-30")));
});

test("grounded analysis accepts claims that cite known evidence IDs", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const metric = bundle.evidence.find((item) => item.kind === "metric");
  assert.ok(metric);

  const parsed = validateGroundedAnalysis({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "Revenue was reported for the latest stored quarter.",
    claims: [
      {
        type: "Fact",
        text: "Stored revenue for the period ending 2026-06-30 is 100 USD.",
        evidenceIds: [metric.id],
      },
    ],
    uncertainties: [],
  }, bundle);

  assert.equal(parsed.claims[0]?.evidenceIds[0], metric.id);
});

test("grounded analysis rejects invented evidence IDs", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);

  assert.throws(() => validateGroundedAnalysis({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "Unsupported claim.",
    claims: [
      {
        type: "Fact",
        text: "This claim cites an evidence item that does not exist.",
        evidenceIds: ["metric:invented"],
      },
    ],
    uncertainties: [],
  }, bundle), /unknown evidence IDs/);
});

test("grounded analysis schema rejects recommendation-shaped extra fields", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const filing = bundle.evidence.find((item) => item.kind === "filing");
  assert.ok(filing);

  assert.throws(() => validateGroundedAnalysis({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "Evidence-only summary.",
    claims: [
      {
        type: "Inference",
        text: "An interpretation based on the filing.",
        evidenceIds: [filing.id],
      },
    ],
    uncertainties: [],
    recommendation: "BUY",
  }, bundle));
});

test("grounded analysis rejects recommendation language hidden inside allowed text fields", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const filing = bundle.evidence.find((item) => item.kind === "filing");
  assert.ok(filing);

  assert.throws(() => validateGroundedAnalysis({
    format: "stockpulse-grounded-analysis",
    version: 1,
    summary: "This evidence means investors should buy the stock.",
    claims: [
      {
        type: "Inference",
        text: "Revenue increased in the stored comparison.",
        evidenceIds: [filing.id],
      },
    ],
    uncertainties: [],
  }, bundle), /recommendation language/);
});
