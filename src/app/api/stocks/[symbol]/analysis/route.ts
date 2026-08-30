import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildGroundingBundle } from "@/lib/ai/grounding";
import { generateGroundedAnalysis, getAiConfiguration } from "@/lib/ai/provider";
import { getStoredMetricChanges } from "@/lib/change-intelligence/repository";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { getStoredSecEvidence } from "@/lib/sec/repository";
import { normalizeStockSymbol } from "@/lib/symbols";
import { evidenceLinkSchema } from "@/lib/thesis/schema";

const thesisContextSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(10_000),
  assumptions: z.array(z.string().trim().min(1).max(1_000)).max(50),
  risks: z.array(z.string().trim().min(1).max(1_000)).max(50),
  catalysts: z.array(z.string().trim().min(1).max(1_000)).max(50),
  invalidationCriteria: z.array(z.string().trim().min(1).max(1_000)).max(50),
  evidenceLinks: z.array(evidenceLinkSchema).max(100),
}).strict();

const requestSchema = z.object({
  mode: z.enum(["summary", "challenge"]),
  thesis: thesisContextSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mode === "challenge" && !value.thesis) {
    ctx.addIssue({ code: "custom", message: "Challenge mode requires an explicit thesis payload" });
  }
});

interface AnalysisRouteProps {
  params: Promise<{ symbol: string }>;
}

export async function POST(request: NextRequest, { params }: AnalysisRouteProps) {
  const limited = rateLimit(getClientIp(request.headers), { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  if (!getAiConfiguration()) {
    return NextResponse.json(
      { available: false, error: "AI analysis is not configured. Deterministic evidence remains available." },
      { status: 503 },
    );
  }

  const { symbol: rawSymbol } = await params;
  let symbol: string;
  try {
    symbol = normalizeStockSymbol(rawSymbol);
  } catch {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid analysis request" },
      { status: 400 },
    );
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
        { error: "No stored evidence is available for grounded analysis" },
        { status: 404 },
      );
    }

    const result = await generateGroundedAnalysis({
      bundle,
      mode: parsed.data.mode,
      thesis: parsed.data.thesis,
    });

    return NextResponse.json(
      { available: true, data: result.analysis, model: result.model },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error(`[Grounded Analysis API] ${symbol}:`, error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        error: timedOut
          ? "AI analysis timed out. Deterministic evidence is still available."
          : "AI analysis failed grounding validation or provider execution. Deterministic evidence is still available.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
