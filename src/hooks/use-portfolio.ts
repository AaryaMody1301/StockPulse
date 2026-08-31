"use client";

import { useState, useEffect, useCallback } from "react";
import {
  parseStoredPortfolio,
  portfolioHoldingSchema,
  portfolioStorageSchema,
  type StoredHolding,
} from "@/lib/client-storage";

const PORTFOLIO_KEY = "stockpulse-portfolio";
const LEGACY_PORTFOLIO_KEY = "investsmart-portfolio";

export type Holding = StoredHolding;

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readPortfolio(): Holding[] {
  if (typeof window === "undefined") return [];

  const currentRaw = localStorage.getItem(PORTFOLIO_KEY);
  if (currentRaw !== null) {
    return parseStoredPortfolio(parseJson(currentRaw)) ?? [];
  }

  const legacyRaw = localStorage.getItem(LEGACY_PORTFOLIO_KEY);
  if (legacyRaw === null) return [];
  const migrated = parseStoredPortfolio(parseJson(legacyRaw));
  if (!migrated) return [];

  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(migrated));
  return migrated;
}

function writePortfolio(holdings: Holding[]) {
  const validated = portfolioStorageSchema.parse(holdings);
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(validated));
  window.dispatchEvent(new CustomEvent("portfolio-change"));
}

export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(readPortfolio);

  useEffect(() => {
    const handler = () => setHoldings(readPortfolio());
    window.addEventListener("portfolio-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("portfolio-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addHolding = useCallback(
    (symbol: string, shares: number, avgCost: number) => {
      const current = readPortfolio();
      const base = portfolioHoldingSchema.safeParse({
        id: crypto.randomUUID(),
        symbol,
        shares,
        avgCost,
        addedAt: new Date().toISOString(),
      });
      if (!base.success) return;

      const existingIndex = current.findIndex((holding) => holding.symbol === base.data.symbol);
      if (existingIndex >= 0) {
        const existing = current[existingIndex];
        if (!existing) return;
        const totalShares = existing.shares + base.data.shares;
        const merged = portfolioHoldingSchema.safeParse({
          ...existing,
          shares: totalShares,
          avgCost: (existing.shares * existing.avgCost + base.data.shares * base.data.avgCost) / totalShares,
        });
        if (!merged.success) return;
        const next = [...current];
        next[existingIndex] = merged.data;
        writePortfolio(next);
        return;
      }

      writePortfolio([...current, base.data]);
    },
    [],
  );

  const removeHolding = useCallback((id: string) => {
    writePortfolio(readPortfolio().filter((holding) => holding.id !== id));
  }, []);

  const updateHolding = useCallback(
    (id: string, shares: number, avgCost: number) => {
      const current = readPortfolio();
      const index = current.findIndex((holding) => holding.id === id);
      if (index < 0) return;
      const existing = current[index];
      if (!existing) return;
      const updated = portfolioHoldingSchema.safeParse({ ...existing, shares, avgCost });
      if (!updated.success) return;
      const next = [...current];
      next[index] = updated.data;
      writePortfolio(next);
    },
    [],
  );

  return { holdings, addHolding, removeHolding, updateHolding };
}
