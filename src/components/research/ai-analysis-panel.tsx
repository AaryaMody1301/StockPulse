"use client";

import { useState } from "react";
import { BrainCircuit, Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GroundedAnalysis } from "@/lib/ai/grounding";
import type { ThesisDraft } from "@/lib/thesis/schema";

export function AiAnalysisPanel({
  symbol,
  mode = "summary",
  thesis,
}: {
  symbol: string;
  mode?: "summary" | "challenge";
  thesis?: ThesisDraft;
}) {
  const [analysis, setAnalysis] = useState<GroundedAnalysis | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          ...(mode === "challenge" && thesis ? { thesis } : {}),
        }),
      });
      const payload = await response.json() as {
        data?: GroundedAnalysis;
        model?: string;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        setAnalysis(null);
        setModel(null);
        setError(payload.error || "Grounded AI analysis is unavailable.");
        return;
      }
      setAnalysis(payload.data);
      setModel(payload.model ?? null);
    } catch {
      setAnalysis(null);
      setModel(null);
      setError("Grounded AI analysis is unavailable. Deterministic evidence remains usable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BrainCircuit className="h-4 w-4 text-primary" />
            {mode === "challenge" ? "Challenge my thesis" : "Grounded AI analysis"}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {mode === "challenge"
              ? "Running this sends the current thesis draft plus the bounded grounding packet to the server-configured AI endpoint. It never stores an API key in the browser."
              : "Optional model synthesis over the bounded grounding packet. Every returned claim must cite a known evidence ID and pass StockPulse validation."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={mode === "challenge" ? "outline" : "default"}
          onClick={() => void runAnalysis()}
          disabled={loading || (mode === "challenge" && !thesis)}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          {loading ? "Analyzing" : mode === "challenge" ? "Challenge thesis" : "Generate analysis"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Validated output</Badge>
              {model && <span className="font-mono text-[10px] text-muted-foreground">{model}</span>}
            </div>
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
          </div>

          <div className="space-y-2">
            {analysis.claims.map((claim, index) => (
              <div key={`${claim.type}-${index}`} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{claim.type}</Badge>
                  <p className="text-sm">{claim.text}</p>
                </div>
                <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                  {claim.evidenceIds.join(" · ")}
                </p>
              </div>
            ))}
          </div>

          {analysis.uncertainties.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uncertainties</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {analysis.uncertainties.map((uncertainty) => <li key={uncertainty}>• {uncertainty}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
