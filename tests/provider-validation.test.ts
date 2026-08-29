import test from "node:test";
import assert from "node:assert/strict";
import {
  finnhubCandleSchema,
  parseFiniteNumber,
  parseProviderPayload,
  twelveDataQuoteSchema,
  twelveDataSearchSchema,
  twelveDataTimeSeriesSchema,
} from "../src/lib/providers/validation";

const logicalError = { status: "error", message: "API credits exhausted" };

test("Twelve Data quote logical error payload is rejected", () => {
  assert.throws(
    () =>
      parseProviderPayload(
        twelveDataQuoteSchema,
        logicalError,
        "Twelve Data",
        "/quote",
      ),
    /invalid payload/,
  );
});

test("Twelve Data search logical error payload is rejected", () => {
  assert.throws(
    () =>
      parseProviderPayload(
        twelveDataSearchSchema,
        logicalError,
        "Twelve Data",
        "/symbol_search",
      ),
    /invalid payload/,
  );
});

test("Twelve Data time-series logical error payload is rejected", () => {
  assert.throws(
    () =>
      parseProviderPayload(
        twelveDataTimeSeriesSchema,
        logicalError,
        "Twelve Data",
        "/time_series",
      ),
    /invalid payload/,
  );
});

test("Finnhub candle payload rejects mismatched arrays", () => {
  assert.throws(
    () =>
      parseProviderPayload(
        finnhubCandleSchema,
        {
          s: "ok",
          c: [10, 11],
          h: [11],
          l: [9, 10],
          o: [9.5, 10.5],
          v: [100, 120],
          t: [1, 2],
        },
        "Finnhub",
        "/stock/candle",
      ),
    /mismatched lengths/,
  );
});

test("parseFiniteNumber rejects non-numeric and empty provider values", () => {
  assert.equal(parseFiniteNumber("123.45", "close"), 123.45);
  assert.throws(() => parseFiniteNumber("not-a-number", "close"), /Invalid numeric value/);
  assert.throws(() => parseFiniteNumber("   ", "close"), /Invalid numeric value/);
});
