import test from "node:test";
import assert from "node:assert/strict";
import {
  finnhubCandleSchema,
  parseFiniteNumber,
  parseProviderPayload,
  twelveDataQuoteSchema,
} from "../src/lib/providers/validation";

test("Twelve Data logical error payload is rejected", () => {
  assert.throws(
    () =>
      parseProviderPayload(
        twelveDataQuoteSchema,
        { status: "error", message: "API credits exhausted" },
        "Twelve Data",
        "/quote",
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

test("parseFiniteNumber rejects non-numeric provider values", () => {
  assert.equal(parseFiniteNumber("123.45", "close"), 123.45);
  assert.throws(() => parseFiniteNumber("not-a-number", "close"), /Invalid numeric value/);
});
