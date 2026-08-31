"use client";

import { useState, useEffect, useCallback } from "react";
import { parseStoredWatchlist, watchlistStorageSchema } from "@/lib/client-storage";

const WATCHLIST_KEY = "stockpulse-watchlist";
const LEGACY_WATCHLIST_KEY = "investsmart-watchlist";

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];

  const currentRaw = localStorage.getItem(WATCHLIST_KEY);
  if (currentRaw !== null) {
    return parseStoredWatchlist(parseJson(currentRaw)) ?? [];
  }

  const legacyRaw = localStorage.getItem(LEGACY_WATCHLIST_KEY);
  if (legacyRaw === null) return [];
  const migrated = parseStoredWatchlist(parseJson(legacyRaw));
  if (!migrated) return [];

  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(migrated));
  return migrated;
}

function writeWatchlist(symbols: string[]) {
  const validated = watchlistStorageSchema.parse(symbols);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(validated));
  window.dispatchEvent(new CustomEvent("watchlist-change"));
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(readWatchlist);

  useEffect(() => {
    const handler = () => setSymbols(readWatchlist());
    window.addEventListener("watchlist-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("watchlist-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const add = useCallback((symbol: string) => {
    const parsed = watchlistStorageSchema.safeParse([...readWatchlist(), symbol]);
    if (parsed.success) writeWatchlist(parsed.data);
  }, []);

  const remove = useCallback((symbol: string) => {
    const upper = symbol.trim().toUpperCase();
    writeWatchlist(readWatchlist().filter((item) => item !== upper));
  }, []);

  const has = useCallback(
    (symbol: string) => symbols.includes(symbol.trim().toUpperCase()),
    [symbols],
  );

  const toggle = useCallback(
    (symbol: string) => {
      if (has(symbol)) remove(symbol);
      else add(symbol);
    },
    [has, add, remove],
  );

  return { symbols, add, remove, has, toggle };
}
