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

function validAnalysis(evidenceId: string) {
  return {
    format: "stockpulse-grounded-analysis" as const,
    version: 1 as const,
    summary: "Revenue was reported for the latest stored quarter.",
    summaryEvidenceIds: [evidenceId],
    claims: [
      {
        type: "Fact" as const,
        text: "Stored revenue for the period ending 2026-06-30 is 100 USD.",
        evidenceIds: [evidenceId],
      },
    ],
    uncertainties: [],
  };
}

test("grounding bundle uses stable evidence IDs for facts and derived changes", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  assert.equal(bundle.format, "stockpulse-grounding");
  assert.equal(bundle.version, 1);
  assert.ok(bundle.evidence.some((item) => item.id === "filing:0000320193-26-000001"));
  assert.ok(bundle.evidence.some((item) => item.id === "metric:revenue:2026-06-30:0000320193-26-000001"));
  assert.ok(bundle.evidence.some((item) => item.id.startsWith("change:revenue:2026-06-30")));
});

test("grounding bundle is unavailable when there are no evidence items", () => {
  assert.equal(buildGroundingBundle({ ...evidence, filings: [], metrics: [] }, null), null);
});

test("grounded analysis accepts summary and claims that cite known evidence IDs", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const metric = bundle.evidence.find((item) => item.kind === "metric");
  assert.ok(metric);

  const parsed = validateGroundedAnalysis(validAnalysis(metric.id), bundle);

  assert.equal(parsed.summaryEvidenceIds[0], metric.id);
  assert.equal(parsed.claims[0]?.evidenceIds[0], metric.id);
});

test("grounded analysis rejects an invented summary evidence ID", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const metric = bundle.evidence.find((item) => item.kind === "metric");
  assert.ok(metric);

  assert.throws(() => validateGroundedAnalysis({
    ...validAnalysis(metric.id),
    summaryEvidenceIds: ["metric:invented-summary"],
  }, bundle), /unknown evidence IDs/);
});

test("grounded analysis rejects invented claim evidence IDs", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const metric = bundle.evidence.find((item) => item.kind === "metric");
  assert.ok(metric);

  assert.throws(() => validateGroundedAnalysis({
    ...validAnalysis(metric.id),
    claims: [
      {
        type: "Fact",
        text: "This claim cites an evidence item that does not exist.",
        evidenceIds: ["metric:invented"],
      },
    ],
  }, bundle), /unknown evidence IDs/);
});

test("grounded analysis schema rejects recommendation-shaped extra fields", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const filing = bundle.evidence.find((item) => item.kind === "filing");
  assert.ok(filing);

  assert.throws(() => validateGroundedAnalysis({
    ...validAnalysis(filing.id),
    recommendation: "BUY",
  }, bundle));
});

test("grounded analysis rejects recommendation language hidden inside allowed text fields", () => {
  const bundle = buildGroundingBundle(evidence, changes);
  assert.ok(bundle);
  const filing = bundle.evidence.find((item) => item.kind === "filing");
  assert.ok(filing);

  assert.throws(() => validateGroundedAnalysis({
    ...validAnalysis(filing.id),
    summary: "This evidence means investors should buy the stock.",
  }, bundle), /recommendation language/);

  assert.throws(() => validateGroundedAnalysis({
    ...validAnalysis(filing.id),
    summary: "The evidence supports an overweight position.",
  }, bundle), /recommendation language/);
});
