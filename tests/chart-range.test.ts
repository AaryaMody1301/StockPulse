import assert from "node:assert/strict";
import test from "node:test";
import { filterBarsByRange, type RangeBar } from "../src/lib/chart-range";

const bars: RangeBar[] = [
  { date: "2026-08-01", open: 100, high: 101, low: 99, close: 100 },
  { date: "2026-08-15", open: 110, high: 111, low: 109, close: 110 },
];

test("empty short chart range does not fall back to the full dataset", () => {
  const filtered = filterBarsByRange(bars, "1W", new Date("2026-08-31T12:00:00.000Z"));
  assert.deepEqual(filtered, []);
});

test("one-year chart range keeps the supplied annual dataset", () => {
  assert.deepEqual(filterBarsByRange(bars, "1Y"), bars);
});
