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
  finnhubCandleSchema,
  finnhubNewsSchema,
  finnhubProfileSchema,
  finnhubQuoteSchema,
  finnhubSearchSchema,
  parseProviderPayload,
} from "./validation";

const BASE_URL = "https://finnhub.io/api/v1";

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  return key;
}

export function buildFinnhubRequest(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return {
    url: url.toString(),
    headers: {
      Accept: "application/json",
      "X-Finnhub-Token": apiKey,
    },
  };
}

async function fetchFinnhub(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const request = buildFinnhubRequest(endpoint, params, getApiKey());
  const res = await fetch(request.url, {
    headers: request.headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Finnhub ${endpoint} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<unknown>;
}

export const finnhub: MarketDataProvider = {
  name: "finnhub",

  async getQuote(symbol: string): Promise<Quote> {
    return cacheGetOrFetch(`finnhub:quote:${symbol}`, REVALIDATE.quotes, async () => {
      const payload = await fetchFinnhub("/quote", { symbol });
      const data = parseProviderPayload(finnhubQuoteSchema, payload, "Finnhub", "/quote");
      return {
        symbol,
        price: data.c,
        change: data.d,
        changePct: data.dp,
        volume: 0, // Finnhub /quote does not include volume.
        high: data.h,
        low: data.l,
        open: data.o,
        prevClose: data.pc,
        timestamp: data.t,
      };
    });
  },

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    return cacheGetOrFetch(`finnhub:search:${query}`, REVALIDATE.search, async () => {
      const payload = await fetchFinnhub("/search", { q: query });
      const data = parseProviderPayload(finnhubSearchSchema, payload, "Finnhub", "/search");
      return data.result
        .filter((result) => result.type === "Common Stock")
        .slice(0, 10)
        .map((result) => ({
          symbol: result.symbol,
          name: result.description,
          type: result.type,
          exchange: "US",
        }));
    });
  },

  async getCompanyProfile(symbol: string): Promise<CompanyProfileData> {
    return cacheGetOrFetch(`finnhub:profile:${symbol}`, REVALIDATE.profile, async () => {
      const payload = await fetchFinnhub("/stock/profile2", { symbol });
      const data = parseProviderPayload(finnhubProfileSchema, payload, "Finnhub", "/stock/profile2");
      return {
        ticker: data.ticker,
        name: data.name,
        logo: data.logo,
        industry: data.finnhubIndustry,
        sector: data.finnhubIndustry,
        marketCap: data.marketCapitalization * 1_000_000,
        website: data.weburl,
        description: "",
        country: data.country,
        currency: data.currency,
      };
    });
  },

  async getDailyBars(symbol: string, from: string, to: string): Promise<DailyBarData[]> {
    return cacheGetOrFetch(`finnhub:candle:${symbol}:${from}:${to}`, REVALIDATE.profile, async () => {
      const fromTs = Math.floor(new Date(from).getTime() / 1000).toString();
      const toTs = Math.floor(new Date(to).getTime() / 1000).toString();

      const payload = await fetchFinnhub("/stock/candle", {
        symbol,
        resolution: "D",
        from: fromTs,
        to: toTs,
      });
      const data = parseProviderPayload(finnhubCandleSchema, payload, "Finnhub", "/stock/candle");

      if (data.s === "no_data" || !data.c || !data.h || !data.l || !data.o || !data.v || !data.t) {
        return [];
      }

      return data.t.map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: data.o![index],
        high: data.h![index],
        low: data.l![index],
        close: data.c![index],
        volume: data.v![index],
      }));
    });
  },

  async getMarketNews(category = "general"): Promise<MarketNewsItem[]> {
    return cacheGetOrFetch(`finnhub:news:${category}`, REVALIDATE.news, async () => {
      const payload = await fetchFinnhub("/news", { category });
      const data = parseProviderPayload(finnhubNewsSchema, payload, "Finnhub", "/news");
      return data.slice(0, 20).map((item) => ({
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        url: item.url,
        imageUrl: item.image,
        category: item.category,
        publishedAt: item.datetime,
      }));
    });
  },
};

/** Fetch company-specific news from Finnhub (not part of the generic provider interface). */
export async function getCompanyNews(
  symbol: string,
): Promise<MarketNewsItem[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  return cacheGetOrFetch(`finnhub:company-news:${symbol}`, REVALIDATE.news, async () => {
    const payload = await fetchFinnhub("/company-news", {
      symbol,
      from,
      to,
    });
    const data = parseProviderPayload(finnhubNewsSchema, payload, "Finnhub", "/company-news");
    return data.slice(0, 10).map((item) => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      imageUrl: item.image,
      category: item.category,
      publishedAt: item.datetime,
    }));
  });
}
