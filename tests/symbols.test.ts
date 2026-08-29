import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStockSymbol,
  normalizeStockSymbols,
} from "../src/lib/symbols";

test("normalizeStockSymbol trims and uppercases valid tickers", () => {
  assert.equal(normalizeStockSymbol(" brk.b "), "BRK.B");
});

test("normalizeStockSymbol rejects malformed input", () => {
  assert.throws(() => normalizeStockSymbol("AAPL;DROP"), /Invalid stock symbol/);
  assert.throws(() => normalizeStockSymbol(""), /Invalid stock symbol/);
});

test("normalizeStockSymbols de-duplicates while preserving order", () => {
  assert.deepEqual(
    normalizeStockSymbols(["aapl", "MSFT", "AAPL"], 4),
    ["AAPL", "MSFT"],
  );
});

test("normalizeStockSymbols enforces the configured bound", () => {
  assert.throws(
    () => normalizeStockSymbols(["A", "B", "C"], 2),
    /Expected between 1 and 2/,
  );
});
