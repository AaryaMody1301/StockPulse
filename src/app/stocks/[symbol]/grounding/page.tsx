import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BrainCircuit, Database, ShieldCheck } from "lucide-react";
import { buildGroundingBundle } from "@/lib/ai/grounding";
import { getStoredMetricChanges } from "@/lib/change-intelligence/repository";
import { getStoredSecEvidence } from "@/lib/sec/repository";
import { normalizeStockSymbol } from "@/lib/symbols";
import { GroundingActions } from "@/components/research/grounding-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface GroundingPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function GroundingPage({ params }: GroundingPageProps) {
  const { symbol: rawSymbol } = await params;
  let symbol: string;
  try {
    symbol = normalizeStockSymbol(rawSymbol);
  } catch {
    notFound();
  }

  const [evidenceResult, changesResult] = await Promise.allSettled([
    getStoredSecEvidence(symbol, 20, 80),
    getStoredMetricChanges(symbol),
  ]);

  const evidence = evidenceResult.status === "fulfilled" ? evidenceResult.value : null;
  const changes = changesResult.status === "fulfilled" ? changesResult.value : null;
  const bundle = buildGroundingBundle(evidence, changes);
  if (!bundle) notFound();

  const counts = bundle.evidence.reduce(
    (acc, item) => {
      acc[item.kind] += 1;
      return acc;
    },
    { filing: 0, metric: 0, change: 0 },
  );

  return (
    <div className="gradient-mesh">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/stocks/${symbol}/changes`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to changes
        </Link>

        <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">AI grounding packet</h1>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                A provider-neutral evidence packet for {bundle.companyName} ({bundle.symbol}).
                It contains source facts and deterministic calculations only; no model has generated or interpreted this content.
              </p>
            </div>
            <Badge variant="outline">AI optional</Badge>
          </div>
          <div className="mt-5">
            <GroundingActions bundle={bundle} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">SEC filings</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold tabular-nums">{counts.filing}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Normalized facts</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold tabular-nums">{counts.metric}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Derived changes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold tabular-nums">{counts.change}</p></CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-border/50">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Grounding rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5">
            {bundle.instructions.map((instruction) => (
              <p key={instruction} className="text-sm text-muted-foreground">• {instruction}</p>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50">
          <CardHeader className="border-b border-border/40 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Evidence IDs
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40 p-0">
            {bundle.evidence.slice(0, 30).map((item) => (
              <div key={item.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.kind}</Badge>
                  <span className="font-medium">{item.label}</span>
                </div>
                <p className="break-all font-mono text-[11px] text-muted-foreground">{item.id}</p>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Open SEC source
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
