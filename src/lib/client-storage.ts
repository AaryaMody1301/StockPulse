import { z } from "zod";
import { normalizeStockSymbol } from "@/lib/symbols";

const storedSymbolSchema = z.string().transform((value, ctx) => {
  try {
    return normalizeStockSymbol(value);
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid stock symbol" });
    return z.NEVER;
  }
});

export const watchlistStorageSchema = z
  .array(storedSymbolSchema)
  .max(100)
  .transform((symbols) => [...new Set(symbols)]);

export const portfolioHoldingSchema = z.object({
  id: z.string().trim().min(1).max(200),
  symbol: storedSymbolSchema,
  shares: z.number().finite().positive().max(1_000_000_000),
  avgCost: z.number().finite().nonnegative().max(1_000_000_000),
  addedAt: z.string().datetime(),
}).strict();

export const portfolioStorageSchema = z.array(portfolioHoldingSchema).max(250);

export type StoredHolding = z.infer<typeof portfolioHoldingSchema>;

export function parseStoredWatchlist(input: unknown): string[] | null {
  const parsed = watchlistStorageSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseStoredPortfolio(input: unknown): StoredHolding[] | null {
  const parsed = portfolioStorageSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
