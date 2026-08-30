export const STOCK_SYMBOL_RE = /^[A-Z0-9.]{1,10}$/;

/** Normalize and validate one US-style ticker symbol used by this app. */
export function normalizeStockSymbol(input: string): string {
  const symbol = input.trim().toUpperCase();
  if (!STOCK_SYMBOL_RE.test(symbol)) {
    throw new Error(`Invalid stock symbol: ${input}`);
  }
  return symbol;
}

/** Normalize, validate, and de-duplicate a bounded list of ticker symbols. */
export function normalizeStockSymbols(inputs: string[], max = 30): string[] {
  if (inputs.length === 0 || inputs.length > max) {
    throw new Error(`Expected between 1 and ${max} stock symbols`);
  }

  return [...new Set(inputs.map(normalizeStockSymbol))];
}
