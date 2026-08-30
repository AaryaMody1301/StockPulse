"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroundingBundle } from "@/lib/ai/grounding";
import { calculateReviewDelta } from "@/lib/thesis/review";
import { listTheses } from "@/lib/thesis/storage";

interface DigestItem {
  symbol: string;
  title: string;
  lastReviewedAt: string | null;
  newEvidence: number;
  filing: number;
  metric: number;
  change: number;
}

export function WatchlistResearchDigest({ symbols }: { symbols: string[] }) {
  const [items, setItems] = useState<DigestItem[]>([]);
  const [trackedTheses, setTrackedTheses] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const theses = await listTheses();
        const watchlist = new Set(symbols.slice(0, 100));
        const tracked = theses.filter((record) => watchlist.has(record.symbol)).slice(0, 12);
        if (cancelled) return;
        setTrackedTheses(tracked.length);

        const results = await Promise.allSettled(
          tracked.map(async (record) => {
            const response = await fetch(`/api/stocks/${record.symbol}/grounding`, { cache: "no-store" });
            if (!response.ok) return null;
            const payload = await response.json() as { data?: GroundingBundle };
            if (!payload.data) return null;
            const delta = calculateReviewDelta(record, payload.data);
            return {
              symbol: record.symbol,
              title: record.title,
              lastReviewedAt: record.lastReviewedAt,
              newEvidence: delta.newEvidence.length,
              ...delta.counts,
            } satisfies DigestItem;
          }),
        );

        if (cancelled) return;
        setItems(results
          .filter((result): result is PromiseFulfilledResult<DigestItem | null> => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((item): item is DigestItem => item !== null)
          .sort((a, b) => b.newEvidence - a.newEvidence || a.symbol.localeCompare(b.symbol)));
      } catch {
        if (!cancelled) {
          setTrackedTheses(0);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [symbols]);

  if (symbols.length === 0) return null;

  const pending = items.filter((item) => item.newEvidence > 0);

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-primary" />
            Research changes since review
          </span>
          <Badge variant={pending.length > 0 ? "secondary" : "outline"}>
            {loading ? "Checking…" : `${pending.length} need review`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {!loading && trackedTheses === 0 && (
          <p className="text-sm text-muted-foreground">
            No saved thesis matches this watchlist yet. <Link href="/research" className="text-primary hover:underline">Create research</Link> to track evidence changes.
          </p>
        )}

        {!loading && trackedTheses > 0 && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No newly stored grounding evidence is pending for the {trackedTheses} watched compan{trackedTheses === 1 ? "y" : "ies"} with saved theses.
          </p>
        )}

        {pending.slice(0, 8).map((item) => (
          <Link
            key={item.symbol}
            href="/research"
            className="flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.symbol}</span>
                <Badge variant="outline">{item.newEvidence} new</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.title}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {item.filing} filing · {item.metric} metric · {item.change} derived change
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
