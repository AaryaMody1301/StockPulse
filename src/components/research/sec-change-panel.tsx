import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StoredMetricChanges } from "@/lib/change-intelligence/repository";

const METRIC_LABELS: Record<string, string> = {
  revenue: "Revenue",
  net_income: "Net income",
  eps: "EPS",
  cash: "Cash",
  debt: "Long-term debt",
  shares: "Shares outstanding",
  operating_cash_flow: "Operating cash flow",
  capex: "Capital expenditure",
};

function formatValue(value: string, unit: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(numeric);
  }
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(numeric) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function SecChangePanel({ changes }: { changes: StoredMetricChanges | null }) {
  if (!changes || changes.changes.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span>What changed in reported metrics</span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">Deterministic</Badge>
            <Link
              href={`/stocks/${changes.symbol}/grounding`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              AI grounding
            </Link>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border/40 p-0">
        {changes.changes.slice(0, 8).map((change) => {
          const Icon = change.direction === "increase"
            ? ArrowUpRight
            : change.direction === "decrease"
              ? ArrowDownRight
              : ArrowRight;
          const percent = change.percentChange === null
            ? "n/a"
            : `${change.percentChange >= 0 ? "+" : ""}${change.percentChange.toFixed(1)}%`;

          return (
            <div key={`${change.metric}-${change.current.endDate}-${change.unit}`} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{METRIC_LABELS[change.metric] ?? change.metric}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Period ending {change.previous.endDate} → {change.current.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                  <span>{formatValue(change.previous.value, change.unit)}</span>
                  <Icon className="h-4 w-4" />
                  <span>{formatValue(change.current.value, change.unit)}</span>
                  <Badge variant="secondary">{percent}</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{change.current.form}</span>
                <span>{change.current.taxonomy}:{change.current.concept}</span>
                <span>Accession {change.current.accessionNumber}</span>
                {change.current.sourceUrl && (
                  <a
                    href={change.current.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    SEC source
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
