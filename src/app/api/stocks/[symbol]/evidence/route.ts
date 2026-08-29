import { NextRequest, NextResponse } from "next/server";
import { getStoredSecEvidence } from "@/lib/sec/repository";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { normalizeStockSymbol } from "@/lib/symbols";

interface EvidenceRouteProps {
  params: Promise<{ symbol: string }>;
}

export async function GET(request: NextRequest, { params }: EvidenceRouteProps) {
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
    const evidence = await getStoredSecEvidence(symbol);
    if (!evidence) {
      return NextResponse.json(
        { error: "No stored evidence for this symbol" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: evidence },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error(`[SEC Evidence API] ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to read SEC evidence" }, { status: 500 });
  }
}
