import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Newspaper, Building2, TrendingUp } from "lucide-react";
import { marketData } from "@/lib/providers";
import { canonicalMarket } from "@/lib/market/repository";
import { getStoredSecEvidence } from "@/lib/sec/repository";
import { normalizeStockSymbol } from "@/lib/symbols";
import type {
  CompanyProfileData,
  DailyBarData,
  MarketNewsItem,
  Quote,
  SymbolSearchResult,
} from "@/lib/providers/types";
import { PriceChange, formatPrice, formatMarketCap } from "@/components/markets/quote-helpers";
import { ChartWithRange } from "@/components/charts/chart-with-range";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WatchlistButton } from "@/components/watchlist-button";
import { AddToPortfolioButton } from "@/components/add-to-portfolio-button";
import { SecEvidencePanel } from "@/components/research/sec-evidence-panel";

export const dynamic = "force-dynamic";

interface StockPageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: StockPageProps): Promise<Metadata> {
  const { symbol } = await params;
  let ticker: string;
  try {
    ticker = normalizeStockSymbol(symbol);
  } catch {
    return {
      title: "Stock Not Found",
      description: "The requested stock symbol is not supported by StockPulse.",
    };
  }
  return {
    title: `${ticker} Stock Price`,
    description: `Latest price, chart, company details, and stored SEC evidence for ${ticker}`,
  };
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-transparent p-3 transition-colors hover:border-border">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StockHeader({
  symbol,
  quote,
  profile,
}: {
  symbol: string;
  quote: Quote;
  profile: CompanyProfileData | null;
}) {
  const isPositive = quote.changePct >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl ${isPositive ? "bg-emerald-500/5" : "bg-red-500/5"}`} />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold">
              {symbol.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
                {profile?.industry && (
                  <Badge variant="secondary" className="text-xs">{profile.industry}</Badge>
                )}
              </div>
              {profile?.name && (
                <p className="mt-0.5 text-muted-foreground">{profile.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WatchlistButton symbol={symbol} />
            <AddToPortfolioButton symbol={symbol} currentPrice={quote.price} />
          </div>
        </div>

        <div className="mt-6 flex items-baseline gap-4">
          <span className="text-4xl font-bold tabular-nums sm:text-5xl">
            {formatPrice(quote.price)}
          </span>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-lg font-semibold ${isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            <PriceChange
              change={quote.change}
              changePct={quote.changePct}
              className="text-lg"
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatItem label="Open" value={formatPrice(quote.open)} />
          <StatItem label="High" value={formatPrice(quote.high)} />
          <StatItem label="Low" value={formatPrice(quote.low)} />
          <StatItem label="Prev Close" value={formatPrice(quote.prevClose)} />
          {profile?.marketCap && profile.marketCap > 0 && (
            <StatItem label="Market Cap" value={formatMarketCap(profile.marketCap)} />
          )}
          {profile?.country && (
            <StatItem label="Country" value={profile.country} />
          )}
          {profile?.currency && (
            <StatItem label="Currency" value={profile.currency} />
          )}
        </div>
      </div>
    </div>
  );
}

function StockChart({
  symbol,
  bars,
}: {
  symbol: string;
  bars: DailyBarData[];
}) {
  if (bars.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          No chart data available for {symbol}.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          Price Chart
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartWithRange symbol={symbol} initialData={bars} />
      </CardContent>
    </Card>
  );
}

function CompanyAbout({
  symbol,
  profile,
}: {
  symbol: string;
  profile: CompanyProfileData | null;
}) {
  if (!profile?.description) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          About {profile.name || symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {profile.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {profile.sector && (
            <div>
              <span className="text-muted-foreground">Sector: </span>
              <span className="font-medium">{profile.sector}</span>
            </div>
          )}
          {profile.industry && (
            <div>
              <span className="text-muted-foreground">Industry: </span>
              <span className="font-medium">{profile.industry}</span>
            </div>
          )}
          {profile.website && (
            <div>
              <span className="text-muted-foreground">Website: </span>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {new URL(profile.website).hostname}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StockNews({ news }: { news: MarketNewsItem[] }) {
  if (news.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Newspaper className="h-3.5 w-3.5 text-amber-500" />
          </div>
          Latest News
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border/40 p-0">
        {news.slice(0, 5).map((item, i) => (
          <a
            key={`${item.url}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <p className="text-sm font-medium leading-snug line-clamp-2">
              {item.headline}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.source} &middot;{" "}
              {new Date(item.publishedAt * 1000).toLocaleDateString()}
            </p>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function RelatedStocks({
  related,
}: {
  related: SymbolSearchResult[];
}) {
  if (related.length === 0) return null;

  return (
    <Card className="overflow-hidden border-border/50">
      <CardHeader className="border-b border-border/40 bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
          </div>
          Related Stocks
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          {related.map((r) => (
            <Link
              key={r.symbol}
              href={`/stocks/${r.symbol}`}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm transition-all hover:bg-primary/5 hover:border-primary/20 hover:shadow-sm"
            >
              <span className="font-semibold group-hover:text-primary transition-colors">{r.symbol}</span>
              <span className="text-muted-foreground truncate max-w-[120px]">
                {r.name}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function StockPage({ params }: StockPageProps) {
  const { symbol: rawSymbol } = await params;
  let symbol: string;
  try {
    symbol = normalizeStockSymbol(rawSymbol);
  } catch {
    notFound();
  }

  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const from = oneYearAgo.toISOString().slice(0, 10);

  const [quoteResult, profileResult, barsResult, newsResult, evidenceResult] =
    await Promise.allSettled([
      canonicalMarket.getQuote(symbol),
      canonicalMarket.getCompanyProfile(symbol),
      canonicalMarket.getDailyBars(symbol, from, to),
      marketData.getCompanyNews(symbol),
      getStoredSecEvidence(symbol),
    ]);

  const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
  const bars = barsResult.status === "fulfilled" ? barsResult.value : [];
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const evidence = evidenceResult.status === "fulfilled" ? evidenceResult.value : null;

  if (!quote) {
    if (quoteResult.status === "rejected") {
      return (
        <div className="gradient-mesh">
          <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Back to Markets
            </Link>
            <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-8">
              <h1 className="text-3xl font-bold">{symbol}</h1>
              <p className="mt-2 text-muted-foreground">
                Latest market data is unavailable right now. Stored SEC evidence remains available below when it has been ingested.
              </p>
            </div>
            <SecEvidencePanel evidence={evidence} />
          </div>
        </div>
      );
    }
    notFound();
  }
  if (quote.price === 0) notFound();

  let related: SymbolSearchResult[] = [];
  if (profile?.industry) {
    try {
      const results = await marketData.searchSymbol(profile.industry);
      related = results
        .filter((r) => r.symbol !== symbol && r.type === "Common Stock")
        .slice(0, 5);
    } catch {
      // Non-critical: related stocks are supplemental.
    }
  }

  return (
    <div className="gradient-mesh">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Markets
        </Link>

        <StockHeader symbol={symbol} quote={quote} profile={profile} />
        <StockChart symbol={symbol} bars={bars} />
        <SecEvidencePanel evidence={evidence} />
        <CompanyAbout symbol={symbol} profile={profile} />

        <div className="grid gap-6 lg:grid-cols-2">
          <StockNews news={news} />
          <RelatedStocks related={related} />
        </div>
      </div>
    </div>
  );
}
