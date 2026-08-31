"use client";

import { useState } from "react";
import { PriceChart } from "@/components/charts/price-chart";
import {
  CHART_RANGES,
  filterBarsByRange,
  type RangeBar,
  type TimeRange,
} from "@/lib/chart-range";
import { cn } from "@/lib/utils";

interface ChartWithRangeProps {
  symbol: string;
  initialData: RangeBar[];
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
        {CHART_RANGES.map(({ label }) => (
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
