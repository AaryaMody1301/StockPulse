import { NextRequest, NextResponse } from "next/server";
import { getStoredMetricChanges } from "@/lib/change-intelligence/repository";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { normalizeStockSymbol } from "@/lib/symbols";

interface ChangeRouteProps {
  params: Promise<{ symbol: string }>;
}

export async function GET(request: NextRequest, { params }: ChangeRouteProps) {
  const limited = rateLimit(getClientIp(request.headers));
  if (limited) return limited;

  const { symbol: rawSymbol } = await params;
  let symbol: string;
  try {
    symbol = normalizeStockSymbol(rawSymbol);
  } catch {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  try {
    const result = await getStoredMetricChanges(symbol);
    if (!result) {
      return NextResponse.json(
        { error: "No stored change data for this symbol" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: result },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error(`[Change Intelligence API] ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to read metric changes" }, { status: 500 });
  }
}
