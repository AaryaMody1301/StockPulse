import assert from "node:assert/strict";
import test from "node:test";
import { calculatePortfolioTotals } from "../src/lib/portfolio-math";

test("missing portfolio quotes are excluded from valuation instead of treated as zero", () => {
  const totals = calculatePortfolioTotals([
    { shares: 10, avgCost: 100, currentPrice: 120 },
    { shares: 5, avgCost: 200, currentPrice: null },
  ]);

  assert.equal(totals.invested, 2000);
  assert.equal(totals.quotedInvested, 1000);
  assert.equal(totals.quotedValue, 1200);
  assert.equal(totals.quotedProfitLoss, 200);
  assert.equal(totals.quotedReturnPct, 20);
  assert.equal(totals.missingPriceCount, 1);
});

test("complete portfolio valuation uses every priced holding", () => {
  const totals = calculatePortfolioTotals([
    { shares: 2, avgCost: 50, currentPrice: 60 },
    { shares: 1, avgCost: 100, currentPrice: 80 },
  ]);

  assert.equal(totals.invested, 200);
  assert.equal(totals.quotedInvested, 200);
  assert.equal(totals.quotedValue, 200);
  assert.equal(totals.quotedProfitLoss, 0);
  assert.equal(totals.quotedReturnPct, 0);
  assert.equal(totals.missingPriceCount, 0);
});
