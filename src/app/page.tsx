import { Suspense } from "react";
import Link from "next/link";
import { canonicalMarket } from "@/lib/market/repository";
import { MarketTable } from "@/components/markets/market-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Globe,
  ChevronRight,
} from "lucide-react";
import { formatPrice } from "@/components/markets/quote-helpers";
import type { Quote } from "@/lib/providers/types";
import { HeroSection } from "@/components/home/hero-section";
import { TickerTapeServer } from "@/components/home/ticker-tape-server";
import { AnimatedQuoteCards } from "@/components/home/animated-quote-cards";
import { MarketPulseCards } from "@/components/home/market-pulse-cards";
import { QuickActions } from "@/components/home/quick-actions";

export const dynamic = "force-dynamic";

const TRENDING_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
  "META", "NVDA", "JPM", "V", "JNJ",
];

const SECTOR_SYMBOLS: Record<string, string[]> = {
  tech: ["AAPL", "MSFT", "GOOGL", "META", "NVDA"],
  finance: ["JPM", "V", "MA", "BAC", "GS"],
  healthcare: ["JNJ", "UNH", "PFE", "ABBV", "MRK"],
};

function UniverseNote() {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Based on a curated starter universe, not a full-market ranking or breadth indicator.
    </p>
  );
}

function MarketTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

function GainersLosersSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

function PulseSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function QuoteCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px] rounded-xl" />
      ))}
    </div>
  );
}

async function TrendingQuotesServer() {
  const quotes = await canonicalMarket.getQuotes(TRENDING_SYMBOLS);
  if (quotes.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Unable to load market data.</p>
        <p className="text-sm">Check configured providers or stored market data.</p>
      </div>
    );
  }
  return <AnimatedQuoteCards quotes={quotes.slice(0, 5)} />;
}

async function SectorTable({ sector }: { sector: string }) {
  const symbols = SECTOR_SYMBOLS[sector] || TRENDING_SYMBOLS;
  const quotes = await canonicalMarket.getQuotes(symbols);
  return <MarketTable quotes={quotes} />;
}

async function FullMarketTable() {
  const quotes = await canonicalMarket.getQuotes(TRENDING_SYMBOLS);
  return <MarketTable quotes={quotes} />;
}

async function GainersLosers() {
  const quotes = await canonicalMarket.getQuotes(TRENDING_SYMBOLS);
  if (quotes.length === 0) return null;

  const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.filter((q) => q.changePct > 0).slice(0, 5);
  const losers = sorted.filter((q) => q.changePct < 0).reverse().slice(0, 5);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            Gainers in Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-4 pb-4">
          {gainers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gainers in the current selection</p>
          ) : (
            gainers.map((q) => <MiniQuoteRow key={q.symbol} quote={q} />)
          )}
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            Losers in Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-4 pb-4">
          {losers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No losers in the current selection</p>
          ) : (
            losers.map((q) => <MiniQuoteRow key={q.symbol} quote={q} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniQuoteRow({ quote }: { quote: Quote }) {
  return (
    <Link
      href={`/stocks/${quote.symbol}`}
      className="flex items-center justify-between rounded-lg px-3 py-2 transition-all hover:bg-muted/50 hover:translate-x-1"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold">
          {quote.symbol.slice(0, 2)}
        </div>
        <span className="text-sm font-semibold">{quote.symbol}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono tabular-nums">{formatPrice(quote.price)}</span>
        <Badge
          variant="secondary"
          className={
            quote.changePct >= 0
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : "bg-red-500/10 text-red-500 border-red-500/20"
          }
        >
          {quote.changePct >= 0 ? "+" : ""}
          {quote.changePct.toFixed(2)}%
        </Badge>
      </div>
    </Link>
  );
}

async function MarketPulseServer() {
  const quotes = await canonicalMarket.getQuotes(TRENDING_SYMBOLS);
  if (quotes.length === 0) return null;

  const avgChange = quotes.reduce((sum, quote) => sum + quote.changePct, 0) / quotes.length;
  const gainers = quotes.filter((quote) => quote.changePct > 0).length;
  const losers = quotes.filter((quote) => quote.changePct < 0).length;

  return (
    <MarketPulseCards
      avgChange={avgChange}
      gainers={gainers}
      losers={losers}
      total={quotes.length}
    />
  );
}

async function TickerTapeDataProvider() {
  const quotes = await canonicalMarket.getQuotes(TRENDING_SYMBOLS);
  if (quotes.length === 0) return null;
  return <TickerTapeServer quotes={quotes} />;
}

export default function HomePage() {
  return (
    <div className="relative">
      <Suspense fallback={null}>
        <TickerTapeDataProvider />
      </Suspense>

      <div className="gradient-mesh">
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
          <HeroSection />
          <QuickActions />

          <section>
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Selected Market Pulse</h2>
              </div>
              <UniverseNote />
            </div>
            <Suspense fallback={<PulseSkeleton />}>
              <MarketPulseServer />
            </Suspense>
          </section>

          <section>
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold">Selected Market Leaders</h2>
                </div>
                <Link
                  href="/watchlist"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View watchlist <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <UniverseNote />
            </div>
            <Suspense fallback={<QuoteCardsSkeleton />}>
              <TrendingQuotesServer />
            </Suspense>
          </section>

          <section>
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Selected Movers</h2>
              </div>
              <UniverseNote />
            </div>
            <Suspense fallback={<GainersLosersSkeleton />}>
              <GainersLosers />
            </Suspense>
          </section>

          <section>
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold">Curated Market Overview</h2>
              </div>
              <UniverseNote />
            </div>

            <Tabs defaultValue="all">
              <TabsList className="bg-muted/50 backdrop-blur-sm">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="tech">Tech</TabsTrigger>
                <TabsTrigger value="finance">Finance</TabsTrigger>
                <TabsTrigger value="healthcare">Healthcare</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <Suspense fallback={<MarketTableSkeleton />}>
                  <FullMarketTable />
                </Suspense>
              </TabsContent>
              <TabsContent value="tech" className="mt-4">
                <Suspense fallback={<MarketTableSkeleton />}>
                  <SectorTable sector="tech" />
                </Suspense>
              </TabsContent>
              <TabsContent value="finance" className="mt-4">
                <Suspense fallback={<MarketTableSkeleton />}>
                  <SectorTable sector="finance" />
                </Suspense>
              </TabsContent>
              <TabsContent value="healthcare" className="mt-4">
                <Suspense fallback={<MarketTableSkeleton />}>
                  <SectorTable sector="healthcare" />
                </Suspense>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  );
}
