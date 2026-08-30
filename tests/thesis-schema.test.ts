import test from "node:test";
import assert from "node:assert/strict";
import {
  evidenceLinkSchema,
  thesisExportBundleSchema,
  thesisRecordSchema,
  thesisSnapshot,
} from "../src/lib/thesis/schema";

const baseRecord = {
  id: "thesis-1",
  symbol: "aapl",
  title: "Durable services thesis",
  summary: "Services mix and installed base remain important to the thesis.",
  assumptions: ["Installed base remains durable"],
  risks: ["Hardware replacement cycles lengthen materially"],
  catalysts: ["Services growth reaccelerates"],
  invalidationCriteria: ["Multi-year installed-base contraction"],
  evidenceLinks: [
    {
      id: "evidence-1",
      label: "10-K",
      url: "https://www.sec.gov/Archives/example.htm",
      relationship: "supports" as const,
      sourceType: "sec" as const,
      notes: "Primary-source filing",
    },
  ],
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  revisions: [],
};

test("thesis records normalize ticker symbols", () => {
  const parsed = thesisRecordSchema.parse(baseRecord);
  assert.equal(parsed.symbol, "AAPL");
});

test("evidence relationship accepts explicit research states", () => {
  for (const relationship of ["supports", "contradicts", "qualifies", "unresolved"] as const) {
    const parsed = evidenceLinkSchema.parse({
      ...baseRecord.evidenceLinks[0],
      relationship,
    });
    assert.equal(parsed.relationship, relationship);
  }
});

test("evidence links reject non-http URL schemes", () => {
  assert.throws(
    () => evidenceLinkSchema.parse({
      ...baseRecord.evidenceLinks[0],
      url: "javascript:alert(1)",
    }),
    /http or https/,
  );
});

test("export bundles are versioned and validated", () => {
  const bundle = thesisExportBundleSchema.parse({
    format: "stockpulse-thesis-export",
    version: 1,
    exportedAt: "2026-08-30T01:00:00.000Z",
    records: [baseRecord],
  });
  assert.equal(bundle.records[0].symbol, "AAPL");
  assert.throws(() => thesisExportBundleSchema.parse({ ...bundle, version: 2 }));
});

test("thesis snapshots exclude storage identity and revision metadata", () => {
  const snapshot = thesisSnapshot(baseRecord);
  assert.equal(snapshot.title, baseRecord.title);
  assert.equal("id" in snapshot, false);
  assert.equal("revisions" in snapshot, false);
});
