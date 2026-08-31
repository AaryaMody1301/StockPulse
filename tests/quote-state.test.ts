import assert from "node:assert/strict";
import test from "node:test";
import { mergeQuoteSnapshot } from "../src/lib/quote-state";
import type { Quote } from "../src/lib/providers/types";

function quote(symbol: string, price: number): Quote {
  return {
    symbol,
    price,
    change: 1,
    changePct: 1,
    volume: 100,
    high: price + 1,
    low: price - 1,
    open: price,
    prevClose: price - 1,
    timestamp: 1,
  };
}

test("partial quote refresh preserves prior values for still-watched symbols", () => {
  const merged = mergeQuoteSnapshot(
    ["AAPL", "MSFT"],
    [quote("AAPL", 100), quote("MSFT", 200)],
    [quote("AAPL", 110)],
  );

  assert.deepEqual(merged.map((item) => [item.symbol, item.price]), [
    ["AAPL", 110],
    ["MSFT", 200],
  ]);
});

test("quote snapshot drops symbols removed from the watchlist", () => {
  const merged = mergeQuoteSnapshot(
    ["AAPL"],
    [quote("AAPL", 100), quote("MSFT", 200)],
    [],
  );

  assert.deepEqual(merged.map((item) => item.symbol), ["AAPL"]);
});
