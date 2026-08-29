/**
 * Quote Polling Worker
 * Runs as a standalone process via PM2.
 * Fetches latest quotes for configured symbols and stores them in PostgreSQL.
 *
 * Usage: npx tsx scripts/poll-quotes.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { finnhub } from "../src/lib/providers/finnhub";
import { normalizeStockSymbols } from "../src/lib/symbols";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const configuredInterval = Number.parseInt(process.env.POLL_INTERVAL_MS || "15000", 10);
const POLL_INTERVAL = Number.isFinite(configuredInterval)
  ? Math.max(configuredInterval, 1000)
  : 15000;
const SYMBOLS = normalizeStockSymbols(
  (process.env.POLL_SYMBOLS || "AAPL,MSFT,GOOGL").split(","),
  30,
);

let timer: NodeJS.Timeout | null = null;
let activePoll: Promise<void> | null = null;
let shuttingDown = false;
let shutdownStarted = false;

async function ensureSymbolsExist(tickers: string[]) {
  for (const ticker of tickers) {
    await db.symbol.upsert({
      where: { ticker },
      update: {},
      create: {
        ticker,
        name: ticker, // Enriched separately when profile ingestion is enabled.
        exchange: "US",
      },
    });
  }
}

async function pollOnce() {
  const startedAt = new Date();
  const jobRun = await db.jobRun.create({
    data: { jobName: "poll-quotes", status: "running", startedAt },
  });

  try {
    const symbolRecords = await db.symbol.findMany({
      where: { ticker: { in: SYMBOLS }, isActive: true },
    });
    const symbolMap = new Map(symbolRecords.map((symbol) => [symbol.ticker, symbol.id]));

    let successCount = 0;
    const failures: Array<{ symbol: string; error: string }> = [];

    for (const ticker of SYMBOLS) {
      try {
        const quote = await finnhub.getQuote(ticker);
        const symbolId = symbolMap.get(ticker);
        if (!symbolId) {
          throw new Error("Configured symbol is missing from the database");
        }
        if (quote.timestamp <= 0 || quote.price <= 0) {
          throw new Error("Provider returned a non-tradable quote");
        }

        const timestamp = new Date(quote.timestamp * 1000);
        const snapshot = {
          price: quote.price,
          change: quote.change,
          changePct: quote.changePct,
          volume: quote.volume,
          high: quote.high,
          low: quote.low,
          open: quote.open,
          prevClose: quote.prevClose,
        };

        // Provider timestamps can remain unchanged outside active trading.
        // Upsert makes repeated polls idempotent instead of violating the
        // @@unique([symbolId, timestamp]) database constraint.
        await db.quoteSnapshot.upsert({
          where: {
            symbolId_timestamp: { symbolId, timestamp },
          },
          update: snapshot,
          create: {
            symbolId,
            timestamp,
            ...snapshot,
          },
        });
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ symbol: ticker, error: message });
        console.error(`  [FAIL] ${ticker}:`, message);
      }
    }

    const status =
      failures.length === 0 ? "success" : successCount === 0 ? "failed" : "partial";

    await db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status,
        endedAt: new Date(),
        metadata: {
          symbolsPolled: SYMBOLS.length,
          succeeded: successCount,
          failed: failures.length,
          failures,
          quoteVolumeSource: "Finnhub /quote does not provide volume; stored value is 0",
        },
      },
    });

    console.log(
      `[${new Date().toISOString()}] Poll ${status}: ${successCount}/${SYMBOLS.length} symbols`,
    );
  } catch (err) {
    await db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        endedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    console.error(`[${new Date().toISOString()}] Poll failed:`, err);
  }
}

async function tick() {
  if (shuttingDown) return;

  activePoll = pollOnce();
  try {
    await activePoll;
  } finally {
    activePoll = null;
  }

  if (!shuttingDown) {
    // Schedule only after the previous cycle completes, preventing overlap.
    timer = setTimeout(() => void tick(), POLL_INTERVAL);
  }
}

async function shutdown() {
  if (shutdownStarted) return;
  shutdownStarted = true;
  shuttingDown = true;
  if (timer) clearTimeout(timer);

  console.log("Shutting down poller...");
  if (activePoll) await activePoll;
  await db.$disconnect();
}

async function main() {
  console.log(
    `Starting quote poller — interval ${POLL_INTERVAL}ms, symbols: ${SYMBOLS.join(", ")}`,
  );
  await ensureSymbolsExist(SYMBOLS);
  await tick();
}

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await shutdown();
  process.exit(1);
});
