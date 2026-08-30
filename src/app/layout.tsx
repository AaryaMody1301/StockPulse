import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHeader } from "@/components/site-header";
import { getAppUrl } from "@/lib/app-url";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getAppUrl(),
  title: {
    default: "StockPulse — Evidence-first investment research",
    template: "%s | StockPulse",
  },
  description:
    "Evidence-first stock research with market data, SEC filings, deterministic change detection, local thesis tracking, and optional citation-validated AI analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <TooltipProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              Skip to main content
            </a>
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader />
              <main id="main-content" className="flex-1">{children}</main>
              <footer className="border-t border-border/40 bg-muted/20">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                        <svg className="h-3 w-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      </div>
                      <span className="text-foreground/80">StockPulse</span>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      &copy; {new Date().getFullYear()} StockPulse. Market data may come from Finnhub and Twelve Data; filing evidence comes from SEC EDGAR. Research tool, not investment advice.
                    </p>
                  </div>
                </div>
              </footer>
            </div>
          </TooltipProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
