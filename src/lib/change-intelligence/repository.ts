import { db } from "@/lib/db";
import { normalizeStockSymbol } from "@/lib/symbols";
import {
  calculateMetricChanges,
  type MetricChange,
  type MetricObservation,
} from "./metric-changes";

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export interface StoredMetricChanges {
  symbol: string;
  companyName: string;
  generatedAt: string;
  changes: MetricChange[];
}

export async function getStoredMetricChanges(rawSymbol: string): Promise<StoredMetricChanges | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;

  const symbol = normalizeStockSymbol(rawSymbol);
  const row = await db.symbol.findUnique({
    where: { ticker: symbol },
    select: {
      name: true,
      secMetrics: {
        orderBy: [{ endDate: "desc" }, { filedAt: "desc" }],
        take: 80,
        select: {
          metric: true,
          value: true,
          unit: true,
          startDate: true,
          endDate: true,
          filedAt: true,
          accessionNumber: true,
          form: true,
          taxonomy: true,
          concept: true,
        },
      },
      secFilings: {
        orderBy: { filedAt: "desc" },
        take: 80,
        select: {
          accessionNumber: true,
          sourceUrl: true,
        },
      },
    },
  });

  if (!row) return null;

  const filingUrls = new Map(
    row.secFilings.map((filing) => [filing.accessionNumber, filing.sourceUrl]),
  );

  const observations: MetricObservation[] = row.secMetrics.map((metric) => ({
    metric: metric.metric,
    value: metric.value.toString(),
    unit: metric.unit,
    startDate: toIsoDate(metric.startDate),
    endDate: toIsoDate(metric.endDate)!,
    filedAt: toIsoDate(metric.filedAt),
    accessionNumber: metric.accessionNumber,
    form: metric.form,
    taxonomy: metric.taxonomy,
    concept: metric.concept,
    sourceUrl: filingUrls.get(metric.accessionNumber) ?? null,
  }));

  return {
    symbol,
    companyName: row.name,
    generatedAt: new Date().toISOString(),
    changes: calculateMetricChanges(observations),
  };
}
