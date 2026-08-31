"use client";

import { useEffect, useState } from "react";
import { getUsMarketStatus, type MarketStatus } from "@/lib/market-calendar";

const STATUS_CONFIG: Record<MarketStatus, { label: string; color: string }> = {
  open: { label: "Market Open", color: "bg-green-500" },
  closed: { label: "Market Closed", color: "bg-red-500" },
  "pre-market": { label: "Pre-Market", color: "bg-amber-500" },
  "after-hours": { label: "After Hours", color: "bg-blue-500" },
};

export function MarketStatusIndicator() {
  const [status, setStatus] = useState<MarketStatus>(() => getUsMarketStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(getUsMarketStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { label, color } = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${color} animate-pulse`} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
