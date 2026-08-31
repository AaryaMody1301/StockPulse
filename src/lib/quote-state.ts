import type { Quote } from "@/lib/providers/types";

export function mergeQuoteSnapshot(
  symbols: string[],
  previous: Quote[],
  fresh: Quote[],
): Quote[] {
  const previousBySymbol = new Map(previous.map((quote) => [quote.symbol, quote]));
  const freshBySymbol = new Map(fresh.map((quote) => [quote.symbol, quote]));

  return symbols
    .map((symbol) => freshBySymbol.get(symbol) ?? previousBySymbol.get(symbol))
    .filter((quote): quote is Quote => Boolean(quote));
}
