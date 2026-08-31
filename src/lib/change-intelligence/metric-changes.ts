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

const DAY_MS = 24 * 60 * 60 * 1000;
// SEC frame guidance treats quarterly and annual duration facts as windows with
// roughly +/-30 day calendar tolerance. Allowing a 62-day difference covers
// the extreme ends of the same period class while keeping quarter/YTD/year
// contexts separated from one another.
const MAX_COMPARABLE_DURATION_DELTA_DAYS = 62;

function observationRank(a: MetricObservation, b: MetricObservation): number {
  const filedCompare = (b.filedAt ?? "").localeCompare(a.filedAt ?? "");
  if (filedCompare !== 0) return filedCompare;
  return b.accessionNumber.localeCompare(a.accessionNumber);
}

function reportingDurationDays(observation: MetricObservation): number | null {
  if (!observation.startDate) return null;
  const start = Date.parse(`${observation.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${observation.endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / DAY_MS) + 1;
}

function sameReportingContext(a: MetricObservation, b: MetricObservation): boolean {
  if (a.metric !== b.metric || a.unit !== b.unit) return false;

  const aIsDuration = a.startDate !== null;
  const bIsDuration = b.startDate !== null;
  if (aIsDuration !== bIsDuration) return false;
  if (!aIsDuration && !bIsDuration) return true;

  const aDuration = reportingDurationDays(a);
  const bDuration = reportingDurationDays(b);
  if (aDuration === null || bDuration === null) return false;
  return Math.abs(aDuration - bDuration) <= MAX_COMPARABLE_DURATION_DELTA_DAYS;
}

function dedupeExactContexts(observations: MetricObservation[]): MetricObservation[] {
  const byContext = new Map<string, MetricObservation[]>();
  for (const observation of observations) {
    const key = [
      observation.metric,
      observation.unit,
      observation.startDate ?? "instant",
      observation.endDate,
    ].join("|");
    const current = byContext.get(key) ?? [];
    current.push(observation);
    byContext.set(key, current);
  }

  return [...byContext.values()]
    .map((context) => [...context].sort(observationRank)[0])
    .filter((observation): observation is MetricObservation => Boolean(observation));
}

function currentContextRank(a: MetricObservation, b: MetricObservation): number {
  // When an issuer reports both a quarter-only and YTD value ending on the
  // same date, prefer the shorter duration so the change represents the most
  // local comparable period. Instant facts naturally rank ahead of durations.
  if (!a.startDate && b.startDate) return -1;
  if (a.startDate && !b.startDate) return 1;
  const aDuration = reportingDurationDays(a) ?? Number.MAX_SAFE_INTEGER;
  const bDuration = reportingDurationDays(b) ?? Number.MAX_SAFE_INTEGER;
  if (aDuration !== bDuration) return aDuration - bDuration;
  return observationRank(a, b);
}

function chooseComparablePair(
  observations: MetricObservation[],
): [MetricObservation, MetricObservation] | null {
  const contexts = dedupeExactContexts(observations);
  if (contexts.length < 2) return null;

  const latestEndDate = contexts.reduce(
    (latest, observation) => observation.endDate > latest ? observation.endDate : latest,
    "",
  );
  const currentCandidates = contexts
    .filter((observation) => observation.endDate === latestEndDate)
    .sort(currentContextRank);

  for (const current of currentCandidates) {
    const previous = contexts
      .filter((candidate) => (
        candidate.endDate < current.endDate && sameReportingContext(current, candidate)
      ))
      .sort((a, b) => {
        const dateCompare = b.endDate.localeCompare(a.endDate);
        if (dateCompare !== 0) return dateCompare;
        const currentDuration = reportingDurationDays(current);
        const aDuration = reportingDurationDays(a);
        const bDuration = reportingDurationDays(b);
        if (currentDuration !== null && aDuration !== null && bDuration !== null) {
          const durationCompare = Math.abs(currentDuration - aDuration) - Math.abs(currentDuration - bDuration);
          if (durationCompare !== 0) return durationCompare;
        }
        return observationRank(a, b);
      })[0];

    if (previous) return [current, previous];
  }

  return null;
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
  for (const metricObservations of grouped.values()) {
    const pair = chooseComparablePair(metricObservations);
    if (!pair) continue;
    const [current, previous] = pair;

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
