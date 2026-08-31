"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, SearchCheck } from "lucide-react";
import { AiAnalysisPanel } from "@/components/research/ai-analysis-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroundingBundle, GroundingEvidence } from "@/lib/ai/grounding";
import { assessResearchCompleteness, calculateReviewDelta } from "@/lib/thesis/review";
import type { EvidenceLink, ThesisDraft, ThesisRecord } from "@/lib/thesis/schema";
import { markThesisReviewed } from "@/lib/thesis/storage";

interface ResearchReviewPanelProps {
  record: ThesisRecord | null;
  draft: ThesisDraft;
  onRecordUpdated: (record: ThesisRecord) => void;
  onAddEvidence: (evidence: EvidenceLink) => void;
}

export function ResearchReviewPanel({
  record,
  draft,
  onRecordUpdated,
  onAddEvidence,
}: ResearchReviewPanelProps) {
  const [bundle, setBundle] = useState<GroundingBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const completeness = useMemo(() => assessResearchCompleteness(draft), [draft]);

  const loadEvidence = useCallback(async () => {
    if (!record?.symbol || record.symbol !== draft.symbol.trim().toUpperCase()) {
      setBundle(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/stocks/${record.symbol}/grounding`, { cache: "no-store" });
      if (!response.ok) {
        setBundle(null);
        setMessage(response.status === 404 ? "No stored SEC evidence is available yet." : "Unable to load stored evidence.");
        return;
      }
      const payload = await response.json() as { data?: GroundingBundle };
      setBundle(payload.data ?? null);
    } catch {
      setBundle(null);
      setMessage("Unable to load stored evidence.");
    } finally {
      setLoading(false);
    }
  }, [record?.symbol, draft.symbol]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  const delta = record && bundle ? calculateReviewDelta(record, bundle) : null;

  async function markReviewed() {
    if (!record || !bundle) return;
    setLoading(true);
    try {
      const updated = await markThesisReviewed(record.id, bundle.evidence.map((item) => item.id));
      onRecordUpdated(updated);
      setMessage("Current evidence checkpoint saved in this browser.");
    } catch {
      setMessage("Unable to save the review checkpoint.");
    } finally {
      setLoading(false);
    }
  }

  function addEvidence(item: GroundingEvidence) {
    if (!item.sourceUrl) return;
    onAddEvidence({
      id: `evidence-${crypto.randomUUID()}`,
      label: item.label.slice(0, 200),
      url: item.sourceUrl,
      relationship: "unresolved",
      sourceType: "sec",
      notes: `Imported from StockPulse grounding evidence: ${item.id}`.slice(0, 2000),
    });
    setMessage("Evidence added to the thesis as unresolved. Save the thesis after classifying it.");
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <SearchCheck className="h-4 w-4 text-primary" />
            Review state
          </span>
          <Badge variant={completeness.score === 100 ? "secondary" : "outline"}>
            Research completeness {completeness.score}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Last evidence review</p>
            <p className="mt-1 text-sm font-medium">
              {record?.lastReviewedAt ? new Date(record.lastReviewedAt).toLocaleString() : "Never reviewed"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">New evidence IDs</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{delta?.newEvidence.length ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Unresolved thesis links</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{completeness.unresolvedEvidence}</p>
          </div>
        </div>

        {completeness.missing.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Research debt: add {completeness.missing.join(", ")}.
          </p>
        )}

        {delta && delta.newEvidence.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{delta.counts.filing} filing</Badge>
              <Badge variant="outline">{delta.counts.metric} metric</Badge>
              <Badge variant="outline">{delta.counts.change} change</Badge>
            </div>
            <div className="divide-y rounded-lg border">
              {delta.newEvidence.slice(0, 6).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{item.id}</p>
                  </div>
                  {item.sourceUrl && (
                    <Button variant="outline" size="sm" onClick={() => addEvidence(item)}>
                      Add to thesis
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {record && bundle && delta?.status === "up-to-date" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No new stored evidence IDs since the last checkpoint.
          </div>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadEvidence()} disabled={loading || !record}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh evidence
          </Button>
          <Button size="sm" onClick={() => void markReviewed()} disabled={loading || !record || !bundle}>
            Mark current evidence reviewed
          </Button>
          {record && (
            <Link href={`/stocks/${record.symbol}/grounding`} className="inline-flex h-7 items-center rounded-md px-2.5 text-[0.8rem] font-medium text-primary hover:underline">
              Open grounding packet
            </Link>
          )}
        </div>

        {record && record.symbol === draft.symbol.trim().toUpperCase() && (
          <AiAnalysisPanel symbol={record.symbol} mode="challenge" thesis={draft} />
        )}
      </CardContent>
    </Card>
  );
}
