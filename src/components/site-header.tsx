import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { StockSearch } from "@/components/stock-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { MarketStatusIndicator } from "@/components/market-status";
import { NavLinks } from "@/components/nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60" role="banner">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <MobileNav />

        <Link href="/" className="group flex items-center gap-2.5 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-110">
            <TrendingUp className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline-block text-lg font-extrabold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            StockPulse
          </span>
        </Link>

        <MarketStatusIndicator />
        <NavLinks />

        <div className="ml-auto flex-1 md:max-w-sm">
          <StockSearch />
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
