import assert from "node:assert/strict";
import test from "node:test";
import { calculateSecRetryDelayMs } from "../src/lib/sec/client";
import { normalizeSubmissionHistory } from "../src/lib/sec/normalization";
import {
  parseSecPayload,
  secSubmissionHistoryFileSchema,
  secSubmissionHistorySchema,
} from "../src/lib/sec/validation";

test("SEC retry delay honors bounded Retry-After values", () => {
  assert.equal(calculateSecRetryDelayMs("2", 1, 0), 2_000);
  assert.equal(calculateSecRetryDelayMs("999", 1, 0), 30_000);
  assert.equal(calculateSecRetryDelayMs(null, 1, 0), 500);
  assert.equal(calculateSecRetryDelayMs(null, 2, 0), 1_000);
});

test("SEC submission history filenames reject traversal and unexpected names", () => {
  assert.equal(
    secSubmissionHistoryFileSchema.parse({
      name: "CIK0000320193-submissions-001.json",
      filingCount: 1000,
      filingFrom: "1994-01-01",
      filingTo: "2015-01-01",
    }).name,
    "CIK0000320193-submissions-001.json",
  );
  assert.throws(() => secSubmissionHistoryFileSchema.parse({
    name: "../secret.json",
    filingCount: 1,
  }));
});

test("SEC continuation rows normalize like recent submission rows", () => {
  const payload = parseSecPayload(secSubmissionHistorySchema, {
    accessionNumber: ["0000320193-15-000001", "0000320193-15-000002"],
    filingDate: ["2015-01-30", "2015-01-31"],
    reportDate: ["2014-12-27", ""],
    acceptanceDateTime: ["2015-01-30T16:00:00.000Z", "2015-01-31T16:00:00.000Z"],
    form: ["10-Q", "S-8"],
    primaryDocument: ["aapl-20141227.htm", "s8.htm"],
  }, "submissions-history");

  const filings = normalizeSubmissionHistory("0000320193", payload);
  assert.equal(filings.length, 1);
  assert.equal(filings[0]?.form, "10-Q");
  assert.equal(filings[0]?.filedAt, "2015-01-30");
});
