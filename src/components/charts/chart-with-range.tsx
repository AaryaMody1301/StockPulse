"use client";

import { useState } from "react";
import { PriceChart } from "@/components/charts/price-chart";
import { cn } from "@/lib/utils";

export type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y";

const RANGES: { label: TimeRange; days: number }[] = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

export interface RangeBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ChartWithRangeProps {
  symbol: string;
  initialData: RangeBar[];
}

export function filterBarsByRange(
  bars: RangeBar[],
  range: TimeRange,
  now = new Date(),
): RangeBar[] {
  if (range === "1Y") return bars;
  const rangeDays = RANGES.find((item) => item.label === range)?.days;
  if (!rangeDays) return [];
  const cutoff = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return bars.filter((bar) => bar.date >= cutoff);
}

export function ChartWithRange({ initialData }: ChartWithRangeProps) {
  const [range, setRange] = useState<TimeRange>("1Y");
  const [data, setData] = useState<RangeBar[]>(initialData);

  function handleRangeChange(newRange: TimeRange) {
    setRange(newRange);
    setData(filterBarsByRange(initialData, newRange));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {RANGES.map(({ label }) => (
          <button
            key={label}
            onClick={() => handleRangeChange(label)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              range === label
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {data.length > 0 ? (
        <PriceChart data={data} />
      ) : (
        <div className="flex h-[400px] items-center justify-center text-muted-foreground">
          No data for this time range
        </div>
      )}
    </div>
  );
}
