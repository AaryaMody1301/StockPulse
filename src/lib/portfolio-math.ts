export interface PortfolioValuationInput {
  shares: number;
  avgCost: number;
  currentPrice: number | null;
}

export interface PortfolioTotals {
  invested: number;
  quotedInvested: number;
  quotedValue: number;
  quotedProfitLoss: number;
  quotedReturnPct: number;
  missingPriceCount: number;
}

function hasUsablePrice(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function calculatePortfolioTotals(
  holdings: PortfolioValuationInput[],
): PortfolioTotals {
  let invested = 0;
  let quotedInvested = 0;
  let quotedValue = 0;
  let missingPriceCount = 0;

  for (const holding of holdings) {
    const costBasis = holding.shares * holding.avgCost;
    invested += costBasis;
    if (!hasUsablePrice(holding.currentPrice)) {
      missingPriceCount += 1;
      continue;
    }
    quotedInvested += costBasis;
    quotedValue += holding.shares * holding.currentPrice;
  }

  const quotedProfitLoss = quotedValue - quotedInvested;
  const quotedReturnPct = quotedInvested > 0
    ? (quotedProfitLoss / quotedInvested) * 100
    : 0;

  return {
    invested,
    quotedInvested,
    quotedValue,
    quotedProfitLoss,
    quotedReturnPct,
    missingPriceCount,
  };
}
