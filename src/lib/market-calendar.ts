import { US_MARKET } from "@/lib/constants";

export type MarketStatus = "open" | "closed" | "pre-market" | "after-hours";

const PUBLISHED_HOLIDAYS: Record<number, ReadonlySet<string>> = {
  2026: new Set([
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  ]),
  2027: new Set([
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
    "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
  ]),
  2028: new Set([
    "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19",
    "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25",
  ]),
};

const PUBLISHED_EARLY_CLOSES: Record<number, ReadonlySet<string>> = {
  2026: new Set(["2026-11-27", "2026-12-24"]),
  2027: new Set(["2027-11-26"]),
  2028: new Set(["2028-07-03", "2028-11-24"]),
};

interface EasternParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

function easternParts(now: Date): EasternParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: US_MARKET.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: weekdayMap[value("weekday")] ?? -1,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function nthWeekday(year: number, monthIndex: number, weekday: number, occurrence: number): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + offset + (occurrence - 1) * 7));
}

function lastWeekday(year: number, monthIndex: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, last.getUTCDate() - offset));
}

function observedFixedHoliday(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function fallbackHolidays(year: number): Set<string> {
  const goodFriday = easterSunday(year);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  const mlk = nthWeekday(year, 0, 1, 3);
  const presidents = nthWeekday(year, 1, 1, 3);
  const memorial = lastWeekday(year, 4, 1);
  const labor = nthWeekday(year, 8, 1, 1);
  const thanksgiving = nthWeekday(year, 10, 4, 4);
  return new Set([
    observedFixedHoliday(year, 0, 1),
    isoDate(year, mlk.getUTCMonth() + 1, mlk.getUTCDate()),
    isoDate(year, presidents.getUTCMonth() + 1, presidents.getUTCDate()),
    isoDate(year, goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate()),
    isoDate(year, memorial.getUTCMonth() + 1, memorial.getUTCDate()),
    observedFixedHoliday(year, 5, 19),
    observedFixedHoliday(year, 6, 4),
    isoDate(year, labor.getUTCMonth() + 1, labor.getUTCDate()),
    isoDate(year, thanksgiving.getUTCMonth() + 1, thanksgiving.getUTCDate()),
    observedFixedHoliday(year, 11, 25),
  ]);
}

function fallbackEarlyCloses(year: number, holidays: ReadonlySet<string>): Set<string> {
  const thanksgiving = nthWeekday(year, 10, 4, 4);
  const afterThanksgiving = new Date(thanksgiving.getTime());
  afterThanksgiving.setUTCDate(afterThanksgiving.getUTCDate() + 1);
  const candidates = [
    new Date(Date.UTC(year, 6, 3)),
    afterThanksgiving,
    new Date(Date.UTC(year, 11, 24)),
  ];
  return new Set(candidates
    .filter((date) => date.getUTCDay() >= 1 && date.getUTCDay() <= 5)
    .map((date) => isoDate(year, date.getUTCMonth() + 1, date.getUTCDate()))
    .filter((date) => !holidays.has(date)));
}

function holidaysForYear(year: number): ReadonlySet<string> {
  return PUBLISHED_HOLIDAYS[year] ?? fallbackHolidays(year);
}

function earlyClosesForYear(year: number, holidays: ReadonlySet<string>): ReadonlySet<string> {
  return PUBLISHED_EARLY_CLOSES[year] ?? fallbackEarlyCloses(year, holidays);
}

export function isUsMarketTradingDate(value: string): boolean {
  const date = parseIsoDate(value);
  if (!date) return false;
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;

  const year = date.getUTCFullYear();
  if (holidaysForYear(year).has(value)) return false;

  // A Saturday New Year's Day can be observed on Dec. 31 of the prior year
  // under the fallback rules, so also check holidays calculated for next year.
  return !holidaysForYear(year + 1).has(value);
}

export function nearestUsMarketTradingDate(
  value: string,
  direction: -1 | 1,
  maxCalendarDays = 14,
): string | null {
  const start = parseIsoDate(value);
  if (!start || maxCalendarDays < 0) return null;

  for (let offset = 0; offset <= maxCalendarDays; offset += 1) {
    const candidate = new Date(start.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + offset * direction);
    const candidateValue = candidate.toISOString().slice(0, 10);
    if (isUsMarketTradingDate(candidateValue)) return candidateValue;
  }

  return null;
}

export function getUsMarketStatus(now = new Date()): MarketStatus {
  const et = easternParts(now);
  const date = isoDate(et.year, et.month, et.day);
  if (!isUsMarketTradingDate(date)) return "closed";

  const holidays = holidaysForYear(et.year);
  const earlyCloses = earlyClosesForYear(et.year, holidays);

  const mins = et.hour * 60 + et.minute;
  const openMins = US_MARKET.openHour * 60 + US_MARKET.openMinute;
  const normalCloseMins = US_MARKET.closeHour * 60 + US_MARKET.closeMinute;
  const closeMins = earlyCloses.has(date) ? 13 * 60 : normalCloseMins;

  if (mins >= openMins && mins < closeMins) return "open";
  if (mins >= 4 * 60 && mins < openMins) return "pre-market";
  if (mins >= closeMins && mins < 20 * 60) return "after-hours";
  return "closed";
}
