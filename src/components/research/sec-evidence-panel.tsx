import { ExternalLink, FileText, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StoredSecEvidence } from "@/lib/sec/repository";

const METRIC_LABELS: Record<string, string> = {
  revenue: "Revenue",
  net_income: "Net Income",
  eps: "EPS",
  cash: "Cash",
  debt: "Debt",
  shares: "Shares Outstanding",
  operating_cash_flow: "Operating Cash Flow",
  capex: "Capital Expenditure",
};

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatMetricValue(metric: StoredSecEvidence["metrics"][number]): string {
  const numeric = Number(metric.value);
  if (!Number.isFinite(numeric)) return metric.value;
  if (metric.unit === "USD") return `$${compactNumber(numeric)}`;
  if (metric.unit.toLowerCase().includes("usd") && metric.unit.toLowerCase().includes("share")) {
    return `$${numeric.toFixed(2)}`;
  }
  if (metric.unit.toLowerCase().includes("share")) return compactNumber(numeric);
  return compactNumber(numeric);
}

export function SecEvidencePanel({ evidence }: { evidence: StoredSecEvidence | null }) {
  if (!evidence || (evidence.filings.length === 0 && evidence.metrics.length === 0)) return null;

  const latestMetrics = new Map<string, StoredSecEvidence["metrics"][number]>();
  for (const metric of evidence.metrics) {
    if (!latestMetrics.has(metric.metric)) latestMetrics.set(metric.metric, metric);
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Landmark className="h-3.5 w-3.5 text-primary" />
            </span>
            SEC Evidence
          </span>
          {evidence.cik && (
            <Badge variant="secondary" className="font-mono text-[11px]">
              CIK {evidence.cik}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        {latestMetrics.size > 0 && (
          <div>
            <div className="mb-3">
              <h3 className="text-sm font-semibold">Latest normalized facts</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Deterministically mapped from SEC XBRL facts. Values retain filing accession and taxonomy provenance.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[...latestMetrics.values()].map((metric) => (
                <div key={metric.metric} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {METRIC_LABELS[metric.metric] || metric.metric}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {formatMetricValue(metric)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Period ending {metric.endDate} · {metric.form}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={`${metric.taxonomy}:${metric.concept}`}>
                    {metric.taxonomy}:{metric.concept}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {evidence.filings.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Recent filings</h3>
            </div>
            <div className="divide-y divide-border/40 rounded-xl border border-border/50">
              {evidence.filings.slice(0, 8).map((filing) => (
                <a
                  key={filing.accessionNumber}
                  href={filing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{filing.form}</Badge>
                      <span className="text-sm font-medium">Filed {filing.filedAt}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                      {filing.accessionNumber}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
