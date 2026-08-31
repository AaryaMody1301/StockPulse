import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getStoredMetricChanges } from "@/lib/change-intelligence/repository";
import { normalizeStockSymbol } from "@/lib/symbols";
import { SecChangePanel } from "@/components/research/sec-change-panel";

interface ChangePageProps {
  params: Promise<{ symbol: string }>;
}

export default async function StockChangesPage({ params }: ChangePageProps) {
  const { symbol: rawSymbol } = await params;
  let symbol: string;
  try {
    symbol = normalizeStockSymbol(rawSymbol);
  } catch {
    notFound();
  }

  let changes = null;
  try {
    changes = await getStoredMetricChanges(symbol);
  } catch {
    // Keep this evidence-only view available as an empty state if storage is unavailable.
  }

  return (
    <div className="gradient-mesh min-h-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/stocks/${symbol}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {symbol}
        </Link>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm font-medium text-primary">Change intelligence</p>
          <h1 className="mt-1 text-3xl font-bold">{symbol}: reported metric changes</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            This view compares stored normalized SEC metrics only when their reporting contexts are comparable. It shows source facts and deterministic calculations only; it does not infer whether a change is good, bad, or an investment recommendation.
          </p>
        </div>

        {changes?.changes.length ? (
          <SecChangePanel changes={changes} />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No comparable stored SEC metric periods are available for {symbol} yet.
          </div>
        )}
      </div>
    </div>
  );
}
