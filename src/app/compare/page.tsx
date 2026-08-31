"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Plus, X, Search, Loader2 } from "lucide-react";
import { normalizeStockSymbol } from "@/lib/symbols";
import { toast } from "sonner";

interface ComparisonData {
  symbol: string;
  bars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
}

const SUGGESTED = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA"];

export default function ComparePage() {
  const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT"]);
  const [input, setInput] = useState("");
  const [data, setData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const addSymbol = useCallback(
    (value: string) => {
      let symbol: string;
      try {
        symbol = normalizeStockSymbol(value);
      } catch {
        toast.error("Enter a valid ticker symbol");
        return;
      }

      if (!symbols.includes(symbol) && symbols.length < 4) {
        setSymbols((previous) => [...previous, symbol]);
        setFetched(false);
        setData([]);
      }
      setInput("");
    },
    [symbols],
  );

  const removeSymbol = useCallback((symbol: string) => {
    setSymbols((previous) => previous.filter((item) => item !== symbol));
    setFetched(false);
    setData([]);
  }, []);

  const fetchComparison = useCallback(async () => {
    if (symbols.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compare?symbols=${symbols.join(",")}`);
      if (!res.ok) {
        setData([]);
        setFetched(true);
        toast.error("Comparison data is unavailable for the selected symbols");
        return;
      }
      const json = await res.json() as { data?: ComparisonData[] };
      setData(json.data || []);
      setFetched(true);
    } catch {
      setData([]);
      setFetched(true);
      toast.error("Comparison data is unavailable right now");
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  return (
    <div className="gradient-mesh min-h-[80vh]">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Stock Comparison</h1>
              <p className="text-muted-foreground">Compare up to 4 stocks side by side</p>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden border-border/60 transition-all duration-300 hover:shadow-lg hover:border-primary/20">
          <CardHeader className="border-b bg-muted/20 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" />
              Select Stocks to Compare
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSymbol(input);
                  }}
                  placeholder="Add ticker symbol (e.g. AAPL)"
                  className="pl-9"
                  disabled={symbols.length >= 4}
                />
              </div>
              <Button
                onClick={() => addSymbol(input)}
                disabled={!input.trim() || symbols.length >= 4}
                size="default"
                className="shadow-md shadow-primary/10"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {symbols.map((symbol) => (
                <Badge key={symbol} variant="secondary" className="gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 font-semibold transition-colors hover:bg-primary/10">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                    {symbol.slice(0, 2)}
                  </span>
                  {symbol}
                  <button
                    onClick={() => removeSymbol(symbol)}
                    className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-destructive/10"
                    aria-label={`Remove ${symbol}`}
                  >
                    <X className="h-3 w-3 hover:text-destructive" />
                  </button>
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED.filter((symbol) => !symbols.includes(symbol)).map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => addSymbol(symbol)}
                  className="rounded-lg border border-dashed border-border/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground hover:shadow-sm"
                  disabled={symbols.length >= 4}
                >
                  + {symbol}
                </button>
              ))}
            </div>

            <Button
              onClick={fetchComparison}
              disabled={symbols.length < 2 || loading}
              className="w-full shadow-md shadow-primary/10 sm:w-auto"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="mr-2 h-4 w-4" />
              )}
              Compare {symbols.length} Stocks
            </Button>
          </CardContent>
        </Card>

        {fetched && data.length >= 2 && (
          <Card className="overflow-hidden border-border/60 transition-all duration-300 hover:shadow-lg hover:border-primary/20">
            <CardHeader className="border-b bg-muted/20 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/10 text-violet-600 dark:text-violet-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                1 Year Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Tabs defaultValue="percent">
                <TabsList className="mb-4">
                  <TabsTrigger value="percent">% Change</TabsTrigger>
                  <TabsTrigger value="price">Absolute Price</TabsTrigger>
                </TabsList>
                <TabsContent value="percent">
                  <ComparisonChart data={data} mode="percent" />
                </TabsContent>
                <TabsContent value="price">
                  <ComparisonChart data={data} mode="price" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {fetched && data.length < 2 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 py-12 text-center text-muted-foreground">
            Could not load enough data to compare. Check the ticker symbols and try again.
          </div>
        )}
      </div>
    </div>
  );
}
