export interface MetricObservation {
  metric: string;
  value: string;
  unit: string;
  startDate: string | null;
  endDate: string;
  filedAt: string | null;
  accessionNumber: string;
  form: string;
  taxonomy: string;
  concept: string;
  sourceUrl: string | null;
}

export interface MetricChange {
  metric: string;
  unit: string;
  current: MetricObservation;
  previous: MetricObservation;
  absoluteChange: number;
  percentChange: number | null;
  direction: "increase" | "decrease" | "unchanged";
}

function observationRank(a: MetricObservation, b: MetricObservation): number {
  const filedCompare = (b.filedAt ?? "").localeCompare(a.filedAt ?? "");
  if (filedCompare !== 0) return filedCompare;
  return b.accessionNumber.localeCompare(a.accessionNumber);
}

function choosePeriodObservations(observations: MetricObservation[]): MetricObservation[] {
  const byPeriod = new Map<string, MetricObservation[]>();
  for (const observation of observations) {
    const key = `${observation.metric}|${observation.unit}|${observation.endDate}`;
    const current = byPeriod.get(key) ?? [];
    current.push(observation);
    byPeriod.set(key, current);
  }

  return [...byPeriod.values()]
    .map((period) => [...period].sort(observationRank)[0])
    .filter((observation): observation is MetricObservation => Boolean(observation))
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

export function calculateMetricChanges(observations: MetricObservation[]): MetricChange[] {
  const grouped = new Map<string, MetricObservation[]>();

  for (const observation of observations) {
    const key = `${observation.metric}|${observation.unit}`;
    const current = grouped.get(key) ?? [];
    current.push(observation);
    grouped.set(key, current);
  }

  const changes: MetricChange[] = [];
  for (const periodObservations of grouped.values()) {
    const periods = choosePeriodObservations(periodObservations);
    if (periods.length < 2) continue;

    const [current, previous] = periods;
    if (!current || !previous) continue;

    const currentValue = Number(current.value);
    const previousValue = Number(previous.value);
    if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) continue;

    const absoluteChange = currentValue - previousValue;
    const percentChange = previousValue === 0
      ? null
      : (absoluteChange / Math.abs(previousValue)) * 100;

    changes.push({
      metric: current.metric,
      unit: current.unit,
      current,
      previous,
      absoluteChange,
      percentChange,
      direction: absoluteChange > 0 ? "increase" : absoluteChange < 0 ? "decrease" : "unchanged",
    });
  }

  return changes.sort((a, b) => {
    const dateCompare = b.current.endDate.localeCompare(a.current.endDate);
    if (dateCompare !== 0) return dateCompare;
    return a.metric.localeCompare(b.metric);
  });
}
