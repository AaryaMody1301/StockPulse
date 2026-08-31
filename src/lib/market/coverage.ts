import {
  latestCompletedUsMarketSessionDate,
  nearestUsMarketTradingDate,
} from "@/lib/market-calendar";

export const DEFAULT_DAILY_START_TOLERANCE_DAYS = 7;

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function hasDailyCoverage(
  dates: string[],
  from: string,
  to: string,
  now = new Date(),
  startToleranceDays = DEFAULT_DAILY_START_TOLERANCE_DAYS,
): boolean {
  if (dates.length === 0 || to < from) return false;

  const latestCompletedSession = latestCompletedUsMarketSessionDate(now);
  if (!latestCompletedSession) return false;

  const expectedEnd = to < latestCompletedSession
    ? nearestUsMarketTradingDate(to, -1)
    : latestCompletedSession;
  if (!expectedEnd) return false;

  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startBoundary = addCalendarDays(from, Math.max(0, startToleranceDays));

  return first <= startBoundary && last >= expectedEnd;
}
