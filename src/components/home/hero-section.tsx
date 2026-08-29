"use client";

import { motion } from "framer-motion";
import { TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card to-primary/5 p-8 sm:p-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Market Analytics
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Invest{" "}
            <span className="relative">
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Smarter
              </span>
              <motion.span
                className="absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-primary to-primary/40"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.8, duration: 0.6 }}
              />
            </span>
          </h1>

          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Market prices, interactive charts, portfolio tracking, and focused
            analytics — all in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/portfolio">
              <Button size="lg" className="group shadow-lg shadow-primary/25">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/news">
              <Button variant="outline" size="lg">
                Latest News
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="mt-8 flex flex-wrap gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {[
            { label: "Latest Prices", icon: "⚡" },
            { label: "Portfolio Tracking", icon: "📊" },
            { label: "10+ Symbols", icon: "📈" },
            { label: "Dark Mode", icon: "🌙" },
          ].map((pill) => (
            <span
              key={pill.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
            >
              <span>{pill.icon}</span>
              {pill.label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
