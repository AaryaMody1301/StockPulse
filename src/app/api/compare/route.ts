import { NextRequest, NextResponse } from "next/server";
import { marketData } from "@/lib/providers";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { normalizeStockSymbols } from "@/lib/symbols";

export async function GET(request: NextRequest) {
  const limited = rateLimit(getClientIp(request.headers));
  if (limited) return limited;

  const rawSymbols = request.nextUrl.searchParams.get("symbols");
  if (!rawSymbols) {
    return NextResponse.json({ error: "Provide 2-4 symbols" }, { status: 400 });
  }

  let symbols: string[];
  try {
    symbols = normalizeStockSymbols(rawSymbols.split(","), 4);
  } catch {
    return NextResponse.json({ error: "Provide 2-4 valid symbols" }, { status: 400 });
  }

  if (symbols.length < 2) {
    return NextResponse.json({ error: "Provide 2-4 distinct symbols" }, { status: 400 });
  }

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => ({
        symbol,
        bars: await marketData.getDailyBars(symbol, from, to),
      })),
    );

    const data = results
      .filter(
        (r): r is PromiseFulfilledResult<{ symbol: string; bars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> }> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);

    const failed = results
      .map((r, i) => (r.status === "rejected" ? symbols[i] : null))
      .filter((symbol): symbol is string => Boolean(symbol));

    return NextResponse.json(
      { data, ...(failed.length > 0 && { failed }) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch comparison data" },
      { status: 502 },
    );
  }
}
