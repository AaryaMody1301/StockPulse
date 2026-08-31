import { db } from "@/lib/db";
import {
  latestCompletedUsMarketSessionDate,
  nearestUsMarketTradingDate,
} from "@/lib/market-calendar";
import { marketData } from "@/lib/providers";
import type { CompanyProfileData, DailyBarData, Quote } from "@/lib/providers/types";
import { normalizeStockSymbol, normalizeStockSymbols } from "@/lib/symbols";

export const MARKET_FRESHNESS = {
  quoteMs: 45_000,
  profileMs: 7 * 24 * 60 * 60 * 1000,
  dailyStartToleranceDays: 7,
} as const;

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addCalendarDays(value: string, days: number): string {
  const date = toDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isStoredQuoteFresh(
  timestamp: Date,
  nowMs = Date.now(),
  maxAgeMs = MARKET_FRESHNESS.quoteMs,
): boolean {
  const age = nowMs - timestamp.getTime();
  return age >= 0 && age <= maxAgeMs;
}

export function hasDailyCoverage(
  dates: string[],
  from: string,
  to: string,
  now = new Date(),
  startToleranceDays = MARKET_FRESHNESS.dailyStartToleranceDays,
): boolean {
  if (dates.length === 0 || to < from) return false;

  const latestCompletedSession = latestCompletedUsMarketSessionDate(now);
  if (!latestCompletedSession) return false;

  const expectedEnd = to < latestCompletedSession
    ? nearestUsMarketTradingDate(to, -1)
    : latestCompletedSession;
  if (!expectedEnd) return false;

  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startBoundary = addCalendarDays(from, Math.max(0, startToleranceDays));

  return first <= startBoundary && last >= expectedEnd;
}

function snapshotToQuote(row: {
  price: { toString(): string };
  change: { toString(): string };
  changePct: { toString(): string };
  volume: bigint;
  high: { toString(): string };
  low: { toString(): string };
  open: { toString(): string };
  prevClose: { toString(): string };
  timestamp: Date;
  symbol: { ticker: string };
}): Quote {
  return {
    symbol: row.symbol.ticker,
    price: Number(row.price.toString()),
    change: Number(row.change.toString()),
    changePct: Number(row.changePct.toString()),
    volume: Number(row.volume),
    high: Number(row.high.toString()),
    low: Number(row.low.toString()),
    open: Number(row.open.toString()),
    prevClose: Number(row.prevClose.toString()),
    timestamp: Math.floor(row.timestamp.getTime() / 1000),
  };
}

function dailyRowToData(row: {
  date: Date;
  open: { toString(): string };
  high: { toString(): string };
  low: { toString(): string };
  close: { toString(): string };
  volume: bigint;
}): DailyBarData {
  return {
    date: row.date.toISOString().slice(0, 10),
    open: Number(row.open.toString()),
    high: Number(row.high.toString()),
    low: Number(row.low.toString()),
    close: Number(row.close.toString()),
    volume: Number(row.volume),
  };
}

async function ensureSymbol(ticker: string, name = ticker) {
  return db.symbol.upsert({
    where: { ticker },
    update: name !== ticker ? { name } : {},
    create: {
      ticker,
      name,
      exchange: "Unknown",
      type: "Common Stock",
    },
  });
}

async function persistQuoteBestEffort(quote: Quote): Promise<void> {
  if (!databaseConfigured()) return;
  try {
    const symbol = await ensureSymbol(quote.symbol);
    await db.quoteSnapshot.upsert({
      where: {
        symbolId_timestamp: {
          symbolId: symbol.id,
          timestamp: new Date(quote.timestamp * 1000),
        },
      },
      update: {
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        volume: BigInt(Math.max(0, Math.trunc(quote.volume))),
        high: quote.high,
        low: quote.low,
        open: quote.open,
        prevClose: quote.prevClose,
      },
      create: {
        symbolId: symbol.id,
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
        volume: BigInt(Math.max(0, Math.trunc(quote.volume))),
        high: quote.high,
        low: quote.low,
        open: quote.open,
        prevClose: quote.prevClose,
        timestamp: new Date(quote.timestamp * 1000),
      },
    });
  } catch (error) {
    console.warn("[CanonicalMarket] quote persistence failed:", error instanceof Error ? error.message : error);
  }
}

async function persistBarsBestEffort(ticker: string, bars: DailyBarData[]): Promise<void> {
  if (!databaseConfigured() || bars.length === 0) return;
  try {
    const symbol = await ensureSymbol(ticker);
    await db.dailyBar.createMany({
      data: bars.map((bar) => ({
        symbolId: symbol.id,
        date: toDateOnly(bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: BigInt(Math.max(0, Math.trunc(bar.volume))),
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.warn("[CanonicalMarket] daily-bar persistence failed:", error instanceof Error ? error.message : error);
  }
}

async function persistProfileBestEffort(profile: CompanyProfileData): Promise<void> {
  if (!databaseConfigured()) return;
  try {
    const symbol = await ensureSymbol(profile.ticker, profile.name || profile.ticker);
    await db.companyProfile.upsert({
      where: { symbolId: symbol.id },
      update: {
        logo: profile.logo || null,
        industry: profile.industry || null,
        sector: profile.sector || null,
        marketCap: profile.marketCap || null,
        website: profile.website || null,
        description: profile.description || null,
        country: profile.country || null,
        currency: profile.currency || null,
      },
      create: {
        symbolId: symbol.id,
        logo: profile.logo || null,
        industry: profile.industry || null,
        sector: profile.sector || null,
        marketCap: profile.marketCap || null,
        website: profile.website || null,
        description: profile.description || null,
        country: profile.country || null,
        currency: profile.currency || null,
      },
    });
  } catch (error) {
    console.warn("[CanonicalMarket] profile persistence failed:", error instanceof Error ? error.message : error);
  }
}

class CanonicalMarketRepository {
  async getQuote(rawSymbol: string): Promise<Quote> {
    const symbol = normalizeStockSymbol(rawSymbol);
    let staleStored: Quote | null = null;

    if (databaseConfigured()) {
      try {
        const row = await db.quoteSnapshot.findFirst({
          where: { symbol: { ticker: symbol } },
          include: { symbol: { select: { ticker: true } } },
          orderBy: { timestamp: "desc" },
        });
        if (row) {
          const quote = snapshotToQuote(row);
          if (isStoredQuoteFresh(row.timestamp) && quote.price > 0) return quote;
          staleStored = quote;
        }
      } catch (error) {
        console.warn("[CanonicalMarket] stored quote read failed:", error instanceof Error ? error.message : error);
      }
    }

    try {
      const quote = await marketData.getQuote(symbol);
      void persistQuoteBestEffort(quote);
      return quote;
    } catch (error) {
      if (staleStored && staleStored.price > 0) return staleStored;
      throw error;
    }
  }

  async getQuotes(rawSymbols: string[]): Promise<Quote[]> {
    const symbols = normalizeStockSymbols(rawSymbols, 30);
    const results = await Promise.allSettled(symbols.map((symbol) => this.getQuote(symbol)));
    return results
      .filter((result): result is PromiseFulfilledResult<Quote> => result.status === "fulfilled")
      .map((result) => result.value);
  }

  async getDailyBars(rawSymbol: string, from: string, to: string): Promise<DailyBarData[]> {
    const symbol = normalizeStockSymbol(rawSymbol);
    let stored: DailyBarData[] = [];

    if (databaseConfigured()) {
      try {
        const rows = await db.dailyBar.findMany({
          where: {
            symbol: { ticker: symbol },
            date: { gte: toDateOnly(from), lte: toDateOnly(to) },
          },
          orderBy: { date: "asc" },
        });
        stored = rows.map(dailyRowToData);
        if (hasDailyCoverage(stored.map((bar) => bar.date), from, to)) return stored;
      } catch (error) {
        console.warn("[CanonicalMarket] stored daily-bar read failed:", error instanceof Error ? error.message : error);
      }
    }

    try {
      const bars = await marketData.getDailyBars(symbol, from, to);
      void persistBarsBestEffort(symbol, bars);
      return bars;
    } catch (error) {
      if (stored.length > 0) return stored;
      throw error;
    }
  }

  async getCompanyProfile(rawSymbol: string): Promise<CompanyProfileData> {
    const symbol = normalizeStockSymbol(rawSymbol);
    let staleStored: CompanyProfileData | null = null;

    if (databaseConfigured()) {
      try {
        const stored = await db.symbol.findUnique({
          where: { ticker: symbol },
          include: { profile: true },
        });
        if (stored?.profile) {
          const profile: CompanyProfileData = {
            ticker: stored.ticker,
            name: stored.name,
            logo: stored.profile.logo || "",
            industry: stored.profile.industry || "",
            sector: stored.profile.sector || "",
            marketCap: stored.profile.marketCap ? Number(stored.profile.marketCap.toString()) : 0,
            website: stored.profile.website || "",
            description: stored.profile.description || "",
            country: stored.profile.country || "",
            currency: stored.profile.currency || "",
          };
          if (Date.now() - stored.profile.updatedAt.getTime() <= MARKET_FRESHNESS.profileMs) {
            return profile;
          }
          staleStored = profile;
        }
      } catch (error) {
        console.warn("[CanonicalMarket] stored profile read failed:", error instanceof Error ? error.message : error);
      }
    }

    try {
      const profile = await marketData.getCompanyProfile(symbol);
      void persistProfileBestEffort(profile);
      return profile;
    } catch (error) {
      if (staleStored) return staleStored;
      throw error;
    }
  }
}

export const canonicalMarket = new CanonicalMarketRepository();
