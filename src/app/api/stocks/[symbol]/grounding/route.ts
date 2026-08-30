import { NextRequest, NextResponse } from "next/server";
import { buildGroundingBundle } from "@/lib/ai/grounding";
import { getStoredMetricChanges } from "@/lib/change-intelligence/repository";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { getStoredSecEvidence } from "@/lib/sec/repository";
import { normalizeStockSymbol } from "@/lib/symbols";

interface GroundingRouteProps {
  params: Promise<{ symbol: string }>;
}

export async function GET(request: NextRequest, { params }: GroundingRouteProps) {
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
    const [evidenceResult, changesResult] = await Promise.allSettled([
      getStoredSecEvidence(symbol, 20, 80),
      getStoredMetricChanges(symbol),
    ]);

    const evidence = evidenceResult.status === "fulfilled" ? evidenceResult.value : null;
    const changes = changesResult.status === "fulfilled" ? changesResult.value : null;
    const bundle = buildGroundingBundle(evidence, changes);

    if (!bundle) {
      return NextResponse.json(
        { error: "No stored evidence is available for a grounding packet" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: bundle },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error(`[Grounding API] ${symbol}:`, error);
    return NextResponse.json(
      { error: "Failed to build grounding packet" },
      { status: 500 },
    );
  }
}
