import assert from "node:assert/strict";
import test from "node:test";
import {
  parseStoredPortfolio,
  parseStoredWatchlist,
} from "../src/lib/client-storage";

test("stored watchlists normalize and deduplicate ticker symbols", () => {
  assert.deepEqual(parseStoredWatchlist(["aapl", " AAPL ", "msft"]), ["AAPL", "MSFT"]);
});

test("stored watchlists reject tampered non-symbol values", () => {
  assert.equal(parseStoredWatchlist(["AAPL", "../../etc/passwd"]), null);
  assert.equal(parseStoredWatchlist({ symbols: ["AAPL"] }), null);
});

test("stored portfolios normalize symbols and reject invalid financial values", () => {
  const valid = parseStoredPortfolio([{
    id: "holding-1",
    symbol: "aapl",
    shares: 2,
    avgCost: 100,
    addedAt: "2026-08-30T00:00:00.000Z",
  }]);
  assert.equal(valid?.[0]?.symbol, "AAPL");

  assert.equal(parseStoredPortfolio([{
    id: "holding-2",
    symbol: "AAPL",
    shares: -1,
    avgCost: 100,
    addedAt: "2026-08-30T00:00:00.000Z",
  }]), null);

  assert.equal(parseStoredPortfolio([{
    id: "holding-3",
    symbol: "AAPL",
    shares: 1,
    avgCost: Number.POSITIVE_INFINITY,
    addedAt: "2026-08-30T00:00:00.000Z",
  }]), null);
});
