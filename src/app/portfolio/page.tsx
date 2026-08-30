"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePortfolio, type Holding } from "@/hooks/use-portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/components/markets/quote-helpers";
import {
  Briefcase,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  PieChart,
  Download,
} from "lucide-react";
import type { Quote } from "@/lib/providers/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RefreshCountdown } from "@/components/refresh-countdown";

interface HoldingWithQuote extends Holding {
  currentPrice: number;
  change: number;
  changePct: number;
}

export default function PortfolioPage() {
  const { holdings, removeHolding } = usePortfolio();
  const [enriched, setEnriched] = useState<HoldingWithQuote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) {
      setEnriched([]);
      return;
    }
    setLoading(true);
    try {
      const symbols = [...new Set(holdings.map((h) => h.symbol))];
      const res = await fetch(`/api/quotes?symbols=${symbols.join(",")}`);
      if (res.ok) {
        const json = await res.json();
        const quoteMap = new Map<string, Quote>();
        for (const q of json.data || []) {
          quoteMap.set(q.symbol, q);
        }
        setEnriched(
          holdings.map((h) => {
            const q = quoteMap.get(h.symbol);
            return {
              ...h,
              currentPrice: q?.price || 0,
              change: q?.change || 0,
              changePct: q?.changePct || 0,
            };
          }),
        );
      }
    } catch {
      // Keep the last successful portfolio state visible on transient errors.
    } finally {
      setLoading(false);
    }
  }, [holdings]);

  useEffect(() => {
    void fetchPrices();
  }, [fetchPrices]);

  const totalInvested = enriched.reduce((sum, holding) => sum + holding.shares * holding.avgCost, 0);
  const totalCurrent = enriched.reduce((sum, holding) => sum + holding.shares * holding.currentPrice, 0);
  const totalPL = totalCurrent - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const exportCSV = () => {
    const header = "Symbol,Shares,Avg Cost,Current Price,Market Value,P&L,P&L %";
    const rows = enriched.map((holding) => {
      const marketValue = holding.shares * holding.currentPrice;
      const costBasis = holding.shares * holding.avgCost;
      const profitLoss = marketValue - costBasis;
      const profitLossPct = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;
      return `${holding.symbol},${holding.shares},${holding.avgCost.toFixed(2)},${holding.currentPrice.toFixed(2)},${marketValue.toFixed(2)},${profitLoss.toFixed(2)},${profitLossPct.toFixed(2)}%`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stockpulse-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Portfolio exported to CSV");
  };

  if (holdings.length === 0) {
    return (
      <div className="gradient-mesh">
        <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <section>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
                <p className="text-muted-foreground">Track your investments and monitor performance</p>
              </div>
            </div>
          </section>

          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50">
              <PieChart className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No holdings yet</h2>
            <p className="mx-auto mb-6 max-w-md text-muted-foreground">
              Add stocks to your portfolio from any stock detail page to start tracking your investments and P&amp;L.
            </p>
            <Link href="/">
              <Button size="lg" className="shadow-lg shadow-primary/25">
                <Plus className="mr-2 h-4 w-4" />
                Browse Markets
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-mesh">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
              <p className="text-muted-foreground">
                {holdings.length} holding{holdings.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RefreshCountdown interval={30} onRefresh={fetchPrices} loading={loading} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={fetchPrices} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Total Value" value={formatPrice(totalCurrent)} />
          <MetricCard label="Invested" value={formatPrice(totalInvested)} />
          <MetricCard
            label="Total P&L"
            value={`${totalPL >= 0 ? "+" : ""}${formatPrice(totalPL)}`}
            className={totalPL >= 0 ? "text-emerald-500" : "text-red-500"}
            icon={
              totalPL >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )
            }
          />
          <MetricCard
            label="Return"
            value={`${totalPLPct >= 0 ? "+" : ""}${totalPLPct.toFixed(2)}%`}
            className={totalPLPct >= 0 ? "text-emerald-500" : "text-red-500"}
          />
        </div>

        {enriched.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {enriched.map((holding, index) => {
                  const weight = totalCurrent > 0 ? (holding.shares * holding.currentPrice) / totalCurrent : 0;
                  if (weight === 0) return null;
                  return (
                    <div
                      key={holding.id}
                      style={{ width: `${weight * 100}%` }}
                      className={cn("h-full transition-all", ALLOCATION_COLORS[index % ALLOCATION_COLORS.length])}
                      title={`${holding.symbol}: ${(weight * 100).toFixed(1)}%`}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {enriched.map((holding, index) => {
                  const weight = totalCurrent > 0 ? (holding.shares * holding.currentPrice) / totalCurrent : 0;
                  if (weight === 0) return null;
                  return (
                    <div key={holding.id} className="flex items-center gap-1.5 text-xs">
                      <div className={cn("h-2.5 w-2.5 rounded-full", ALLOCATION_COLORS[index % ALLOCATION_COLORS.length])} />
                      <span className="font-medium">{holding.symbol}</span>
                      <span className="text-muted-foreground">{(weight * 100).toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Market Value</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enriched.map((holding) => {
                const marketValue = holding.shares * holding.currentPrice;
                const costBasis = holding.shares * holding.avgCost;
                const profitLoss = marketValue - costBasis;
                const profitLossPct = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

                return (
                  <TableRow key={holding.id} className="hover:bg-muted/50">
                    <TableCell className="font-semibold">
                      <Link href={`/stocks/${holding.symbol}`} className="hover:underline">
                        {holding.symbol}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{holding.shares}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatPrice(holding.avgCost)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {holding.currentPrice > 0 ? formatPrice(holding.currentPrice) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {holding.currentPrice > 0 ? formatPrice(marketValue) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums font-medium",
                        profitLoss >= 0 ? "text-emerald-500" : "text-red-500",
                      )}
                    >
                      {holding.currentPrice > 0 ? (
                        <>
                          {profitLoss >= 0 ? "+" : ""}
                          {formatPrice(profitLoss)}
                          <span className="ml-1 text-xs">
                            ({profitLossPct >= 0 ? "+" : ""}{profitLossPct.toFixed(2)}%)
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeHolding(holding.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const ALLOCATION_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-pink-500",
];

function MetricCard({
  label,
  value,
  className,
  icon,
}: {
  label: string;
  value: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-muted/30 to-transparent transition-all hover:shadow-md hover:border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">{icon}</div>}
        </div>
        <p className={cn("mt-1 text-xl font-bold tabular-nums", className)}>{value}</p>
      </CardContent>
    </Card>
  );
}
