import { cacheGetOrFetch } from "@/lib/cache";
import { REVALIDATE } from "@/lib/constants";
import type {
  CompanyProfileData,
  DailyBarData,
  MarketDataProvider,
  MarketNewsItem,
  Quote,
  SymbolSearchResult,
} from "./types";
import {
  parseFiniteNumber,
  parseProviderPayload,
  twelveDataQuoteSchema,
  twelveDataSearchSchema,
  twelveDataTimeSeriesSchema,
} from "./validation";

const BASE_URL = "https://api.twelvedata.com";

function getApiKey(): string {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) throw new Error("TWELVEDATA_API_KEY is not set");
  return key;
}

async function fetchTwelveData(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("apikey", getApiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: REVALIDATE.quotes },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Twelve Data ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

export const twelvedata: MarketDataProvider = {
  name: "twelvedata",

  async getQuote(symbol: string): Promise<Quote> {
    return cacheGetOrFetch(`td:quote:${symbol}`, REVALIDATE.quotes, async () => {
      const payload = await fetchTwelveData("/quote", { symbol });
      const data = parseProviderPayload(twelveDataQuoteSchema, payload, "Twelve Data", "/quote");
      return {
        symbol: data.symbol,
        price: parseFiniteNumber(data.close, "close"),
        change: parseFiniteNumber(data.change, "change"),
        changePct: parseFiniteNumber(data.percent_change, "percent_change"),
        volume: parseFiniteNumber(data.volume, "volume"),
        high: parseFiniteNumber(data.high, "high"),
        low: parseFiniteNumber(data.low, "low"),
        open: parseFiniteNumber(data.open, "open"),
        prevClose: parseFiniteNumber(data.previous_close, "previous_close"),
        timestamp: parseFiniteNumber(data.timestamp, "timestamp"),
      };
    });
  },

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    return cacheGetOrFetch(`td:search:${query}`, REVALIDATE.search, async () => {
      const payload = await fetchTwelveData("/symbol_search", {
        symbol: query,
        outputsize: "10",
      });
      const data = parseProviderPayload(twelveDataSearchSchema, payload, "Twelve Data", "/symbol_search");
      return data.data.map((r) => ({
        symbol: r.symbol,
        name: r.instrument_name,
        type: r.instrument_type,
        exchange: r.exchange,
      }));
    });
  },

  async getCompanyProfile(symbol: string): Promise<CompanyProfileData> {
    void symbol;
    throw new Error("Company profile not available on Twelve Data free tier");
  },

  async getDailyBars(symbol: string, from: string, to: string): Promise<DailyBarData[]> {
    return cacheGetOrFetch(`td:bars:${symbol}:${from}:${to}`, REVALIDATE.profile, async () => {
      const payload = await fetchTwelveData("/time_series", {
        symbol,
        interval: "1day",
        start_date: from,
        end_date: to,
        outputsize: "365",
      });
      const data = parseProviderPayload(twelveDataTimeSeriesSchema, payload, "Twelve Data", "/time_series");
      return data.values
        .map((v) => ({
          date: v.datetime,
          open: parseFiniteNumber(v.open, "open"),
          high: parseFiniteNumber(v.high, "high"),
          low: parseFiniteNumber(v.low, "low"),
          close: parseFiniteNumber(v.close, "close"),
          volume: parseFiniteNumber(v.volume, "volume"),
        }))
        .reverse();
    });
  },

  async getMarketNews(category?: string): Promise<MarketNewsItem[]> {
    void category;
    return [];
  },
};
