import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSecFilingUrl,
  normalizeCik,
  normalizeCompanyFacts,
  normalizeSubmissions,
  resolveTickerIdentity,
} from "../src/lib/sec/normalization";
import {
  parseSecPayload,
  secCompanyFactsSchema,
  secSubmissionsSchema,
  secTickerMapSchema,
} from "../src/lib/sec/validation";

test("normalizeCik pads numeric CIK values to ten digits", () => {
  assert.equal(normalizeCik(320193), "0000320193");
  assert.equal(normalizeCik("0000320193"), "0000320193");
  assert.throws(() => normalizeCik("not-a-cik"), /Invalid SEC CIK/);
});

test("ticker mapping resolves a normalized SEC identity", () => {
  const payload = parseSecPayload(
    secTickerMapSchema,
    {
      "0": { cik_str: 320193, ticker: "aapl", title: "Apple Inc." },
    },
    "company_tickers.json",
  );
  assert.deepEqual(resolveTickerIdentity(payload, " AAPL "), {
    cik: "0000320193",
    ticker: "AAPL",
    title: "Apple Inc.",
  });
});

test("submissions normalization keeps research forms and preserves filing provenance", () => {
  const payload = parseSecPayload(
    secSubmissionsSchema,
    {
      cik: "0000320193",
      name: "Apple Inc.",
      tickers: ["AAPL"],
      exchanges: ["Nasdaq"],
      filings: {
        recent: {
          accessionNumber: ["0000320193-26-000001", "0000320193-26-000002"],
          filingDate: ["2026-08-01", "2026-08-02"],
          reportDate: ["2026-06-30", ""],
          acceptanceDateTime: ["2026-08-01T16:00:00.000Z", "2026-08-02T16:00:00.000Z"],
          form: ["10-Q", "S-8"],
          primaryDocument: ["aapl-20260630.htm", "s8.htm"],
        },
        files: [],
      },
    },
    "submissions",
  );

  const filings = normalizeSubmissions(payload);
  assert.equal(filings.length, 1);
  assert.equal(filings[0].form, "10-Q");
  assert.equal(filings[0].reportDate, "2026-06-30");
  assert.equal(
    filings[0].sourceUrl,
    "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/aapl-20260630.htm",
  );
});

test("submissions normalization rejects mismatched column arrays", () => {
  const payload = parseSecPayload(
    secSubmissionsSchema,
    {
      cik: "0000320193",
      name: "Apple Inc.",
      tickers: ["AAPL"],
      exchanges: ["Nasdaq"],
      filings: {
        recent: {
          accessionNumber: ["0000320193-26-000001"],
          filingDate: [],
          reportDate: ["2026-06-30"],
          acceptanceDateTime: ["2026-08-01T16:00:00.000Z"],
          form: ["10-Q"],
          primaryDocument: ["aapl.htm"],
        },
        files: [],
      },
    },
    "submissions",
  );
  assert.throws(() => normalizeSubmissions(payload), /mismatched lengths/);
});

test("companyfacts normalization uses deterministic preferred concepts", () => {
  const payload = parseSecPayload(
    secCompanyFactsSchema,
    {
      cik: 320193,
      entityName: "Apple Inc.",
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            label: "Revenue",
            description: "Revenue from customers",
            units: {
              USD: [
                {
                  start: "2026-04-01",
                  end: "2026-06-30",
                  val: 100000000000,
                  accn: "0000320193-26-000001",
                  fy: 2026,
                  fp: "Q3",
                  form: "10-Q",
                  filed: "2026-08-01",
                  frame: "CY2026Q2",
                },
              ],
            },
          },
          Revenues: {
            label: "Fallback revenue",
            units: {
              USD: [
                {
                  start: "2026-04-01",
                  end: "2026-06-30",
                  val: 999,
                  accn: "0000320193-26-000001",
                  form: "10-Q",
                  filed: "2026-08-01",
                },
              ],
            },
          },
          NetIncomeLoss: {
            label: "Net income",
            units: {
              USD: [
                {
                  start: "2026-04-01",
                  end: "2026-06-30",
                  val: 25000000000,
                  accn: "0000320193-26-000001",
                  form: "10-Q",
                  filed: "2026-08-01",
                },
              ],
            },
          },
        },
        dei: {
          EntityCommonStockSharesOutstanding: {
            label: "Shares outstanding",
            units: {
              shares: [
                {
                  end: "2026-07-25",
                  val: 15000000000,
                  accn: "0000320193-26-000001",
                  form: "10-Q",
                  filed: "2026-08-01",
                },
              ],
            },
          },
        },
      },
    },
    "companyfacts",
  );

  const normalized = normalizeCompanyFacts(payload);
  const revenue = normalized.metrics.find((metric) => metric.metric === "revenue");
  const shares = normalized.metrics.find((metric) => metric.metric === "shares");
  assert.equal(revenue?.concept, "RevenueFromContractWithCustomerExcludingAssessedTax");
  assert.equal(revenue?.value, "100000000000");
  assert.equal(shares?.value, "15000000000");
  assert.ok(revenue?.metricKey.match(/^[a-f0-9]{64}$/));
  assert.ok(normalized.facts.some((fact) => fact.accessionNumber === "0000320193-26-000001"));
});

test("filing URL construction normalizes CIK and accession formatting", () => {
  assert.equal(
    buildSecFilingUrl("320193", "0000320193-26-000001", "report.htm"),
    "https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/report.htm",
  );
});
