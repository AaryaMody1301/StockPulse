export type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y";

export const CHART_RANGES: { label: TimeRange; days: number }[] = [
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

export function filterBarsByRange(
  bars: RangeBar[],
  range: TimeRange,
  now = new Date(),
): RangeBar[] {
  if (range === "1Y") return bars;
  const rangeDays = CHART_RANGES.find((item) => item.label === range)?.days;
  if (!rangeDays) return [];
  const cutoff = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return bars.filter((bar) => bar.date >= cutoff);
}
