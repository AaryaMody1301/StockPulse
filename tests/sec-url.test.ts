import assert from "node:assert/strict";
import test from "node:test";
import { buildSecFilingUrl } from "../src/lib/sec/normalization";

test("SEC filing URLs preserve safe document subdirectories", () => {
  assert.equal(
    buildSecFilingUrl("0000320193", "0000320193-26-000001", "reports/form 10-q.htm"),
    "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/reports/form%2010-q.htm",
  );
});

test("SEC filing URLs reject traversal-like document segments", () => {
  assert.equal(
    buildSecFilingUrl("0000320193", "0000320193-26-000001", "../outside.htm"),
    "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/",
  );
});
