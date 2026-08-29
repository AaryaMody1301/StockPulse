import "dotenv/config";
import { db } from "../src/lib/db";
import { ingestSecEvidence } from "../src/lib/sec/repository";
import { normalizeStockSymbols } from "../src/lib/symbols";

async function main() {
  const rawSymbols = process.argv.slice(2);
  if (rawSymbols.length === 0) {
    throw new Error("Usage: npm run ingest:sec -- AAPL MSFT");
  }

  const symbols = normalizeStockSymbols(rawSymbols, 30);
  for (const symbol of symbols) {
    console.log(`[SEC] ingesting ${symbol}...`);
    const summary = await ingestSecEvidence(symbol);
    console.log(JSON.stringify(summary, null, 2));
  }
}

main()
  .catch((error) => {
    console.error("SEC ingestion failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
