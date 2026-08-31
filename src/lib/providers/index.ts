import { finnhub, getCompanyNews } from "./finnhub";
import { twelvedata } from "./twelvedata";
import { normalizeStockSymbol } from "@/lib/symbols";
import type { MarketDataProvider, Quote, SymbolSearchResult, CompanyProfileData, DailyBarData, MarketNewsItem } from "./types";

export type { Quote, SymbolSearchResult, CompanyProfileData, DailyBarData, MarketNewsItem } from "./types";

export function normalizeSearchResults(results: SymbolSearchResult[]): SymbolSearchResult[] {
  const normalized: SymbolSearchResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    let symbol: string;
    try {
      symbol = normalizeStockSymbol(result.symbol);
    } catch {
      continue;
    }
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    normalized.push({ ...result, symbol });
    if (normalized.length >= 10) break;
  }

  return normalized;
}

/**
 * Unified market data service with automatic fallback.
 * Primary: Finnhub | Backup: Twelve Data
 */
class MarketDataService {
  private primary: MarketDataProvider = finnhub;
  private backup: MarketDataProvider = twelvedata;

  private async withFallback<T>(
    fn: (provider: MarketDataProvider) => Promise<T>,
  ): Promise<T> {
    try {
      return await fn(this.primary);
    } catch (primaryErr) {
      console.warn(`[MarketData] ${this.primary.name} failed, trying ${this.backup.name}:`,
        primaryErr instanceof Error ? primaryErr.message : primaryErr);
      return fn(this.backup);
    }
  }

  async getQuote(symbol: string): Promise<Quote> {
    const s = normalizeStockSymbol(symbol);
    return this.withFallback((p) => p.getQuote(s));
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const results = await Promise.allSettled(
      symbols.map((s) => this.getQuote(s)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const q = query.trim().slice(0, 50);
    if (!q) return [];
    const results = await this.withFallback((p) => p.searchSymbol(q));
    return normalizeSearchResults(results);
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfileData> {
    const s = normalizeStockSymbol(symbol);
    try {
      return await finnhub.getCompanyProfile(s);
    } catch (err) {
      console.warn(`[MarketData] getCompanyProfile(${s}) failed:`,
        err instanceof Error ? err.message : err);
      throw err;
    }
  }

  async getDailyBars(symbol: string, from: string, to: string): Promise<DailyBarData[]> {
    const s = normalizeStockSymbol(symbol);
    return this.withFallback((p) => p.getDailyBars(s, from, to));
  }

  async getMarketNews(category?: string): Promise<MarketNewsItem[]> {
    return finnhub.getMarketNews(category);
  }

  async getCompanyNews(symbol: string): Promise<MarketNewsItem[]> {
    const s = normalizeStockSymbol(symbol);
    return getCompanyNews(s);
  }
}

export const marketData = new MarketDataService();
