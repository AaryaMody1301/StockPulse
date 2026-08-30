import { NextRequest, NextResponse } from "next/server";
import { marketData } from "@/lib/providers";
import { REVALIDATE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { normalizeStockSymbols } from "@/lib/symbols";

export async function GET(request: NextRequest) {
  const limited = rateLimit(getClientIp(request.headers));
  if (limited) return limited;

  const rawSymbols = request.nextUrl.searchParams.get("symbols");
  if (!rawSymbols) {
    return NextResponse.json(
      { error: "Invalid symbols parameter. Provide comma-separated tickers." },
      { status: 400 },
    );
  }

  let symbols: string[];
  try {
    symbols = normalizeStockSymbols(rawSymbols.split(","), 30);
  } catch {
    return NextResponse.json(
      { error: "Invalid symbols parameter. Provide 1-30 valid ticker symbols." },
      { status: 400 },
    );
  }

  try {
    const quotes = await marketData.getQuotes(symbols);
    return NextResponse.json(
      { data: quotes },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${REVALIDATE.quotes}, stale-while-revalidate=${REVALIDATE.quotes * 2}`,
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 502 });
  }
}
