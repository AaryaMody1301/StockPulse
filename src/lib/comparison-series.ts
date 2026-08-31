export interface ComparisonBar {
  date: string;
  close: number;
}

export interface ComparisonSeriesInput {
  symbol: string;
  bars: ComparisonBar[];
}

export interface ComparisonPoint {
  time: string;
  value: number;
}

export function findCommonComparisonStart(
  data: ComparisonSeriesInput[],
): string | null {
  if (data.length === 0 || data.some((series) => series.bars.length === 0)) return null;

  let common = new Set(data[0]?.bars.map((bar) => bar.date) ?? []);
  for (const series of data.slice(1)) {
    const dates = new Set(series.bars.map((bar) => bar.date));
    common = new Set([...common].filter((date) => dates.has(date)));
    if (common.size === 0) return null;
  }

  return [...common].sort((a, b) => a.localeCompare(b))[0] ?? null;
}

export function buildComparisonLineData(
  series: ComparisonSeriesInput,
  mode: "price" | "percent",
  commonStartDate: string | null,
): ComparisonPoint[] {
  if (mode === "price") {
    return series.bars.map((bar) => ({ time: bar.date, value: bar.close }));
  }
  if (!commonStartDate) return [];

  const bars = series.bars.filter((bar) => bar.date >= commonStartDate);
  const basePrice = bars.find((bar) => bar.date === commonStartDate)?.close;
  if (!basePrice || !Number.isFinite(basePrice) || basePrice <= 0) return [];

  return bars.map((bar) => ({
    time: bar.date,
    value: ((bar.close - basePrice) / basePrice) * 100,
  }));
}
