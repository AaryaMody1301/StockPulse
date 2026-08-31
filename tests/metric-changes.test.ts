import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMetricChanges,
  type MetricObservation,
} from "../src/lib/change-intelligence/metric-changes";

function observation(overrides: Partial<MetricObservation> = {}): MetricObservation {
  return {
    metric: "revenue",
    value: "100",
    unit: "USD",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    filedAt: "2026-02-01",
    accessionNumber: "0000000000-26-000001",
    form: "10-K",
    taxonomy: "us-gaap",
    concept: "Revenues",
    sourceUrl: "https://www.sec.gov/example",
    ...overrides,
  };
}

test("calculates deterministic period-over-period increase for comparable annual contexts", () => {
  const changes = calculateMetricChanges([
    observation({ value: "120", startDate: "2025-01-01", endDate: "2025-12-31" }),
    observation({
      value: "100",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      accessionNumber: "0000000000-25-000001",
    }),
  ]);

  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.absoluteChange, 20);
  assert.equal(changes[0]?.percentChange, 20);
  assert.equal(changes[0]?.direction, "increase");
});

test("uses the latest filing for an amended exact reporting context", () => {
  const changes = calculateMetricChanges([
    observation({ value: "110", filedAt: "2026-01-15", accessionNumber: "0000000000-26-000001" }),
    observation({ value: "120", filedAt: "2026-02-15", accessionNumber: "0000000000-26-000002" }),
    observation({
      value: "100",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      filedAt: "2025-02-01",
      accessionNumber: "0000000000-25-000001",
    }),
  ]);

  assert.equal(changes[0]?.current.value, "120");
  assert.equal(changes[0]?.current.accessionNumber, "0000000000-26-000002");
});

test("returns null percentage when the previous comparable period is zero", () => {
  const changes = calculateMetricChanges([
    observation({ value: "25", startDate: "2025-01-01", endDate: "2025-12-31" }),
    observation({
      value: "0",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      accessionNumber: "0000000000-25-000001",
    }),
  ]);

  assert.equal(changes[0]?.absoluteChange, 25);
  assert.equal(changes[0]?.percentChange, null);
});

test("does not compare observations with different units", () => {
  const changes = calculateMetricChanges([
    observation({ value: "120", unit: "USD", startDate: "2025-01-01", endDate: "2025-12-31" }),
    observation({ value: "100", unit: "EUR", startDate: "2024-01-01", endDate: "2024-12-31" }),
  ]);

  assert.equal(changes.length, 0);
});

test("does not compare a quarterly duration fact with an annual duration fact", () => {
  const changes = calculateMetricChanges([
    observation({
      value: "30",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filedAt: "2026-07-31",
      accessionNumber: "0000000000-26-000010",
      form: "10-Q",
    }),
    observation({
      value: "100",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      filedAt: "2026-02-01",
      accessionNumber: "0000000000-26-000001",
      form: "10-K",
    }),
  ]);

  assert.equal(changes.length, 0);
});

test("prefers a quarter-only fact over YTD when both end on the latest date", () => {
  const changes = calculateMetricChanges([
    observation({
      value: "35",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      filedAt: "2026-07-31",
      accessionNumber: "0000000000-26-000020",
      form: "10-Q",
    }),
    observation({
      value: "65",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      filedAt: "2026-07-31",
      accessionNumber: "0000000000-26-000020",
      form: "10-Q",
    }),
    observation({
      value: "30",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      filedAt: "2026-05-01",
      accessionNumber: "0000000000-26-000010",
      form: "10-Q",
    }),
  ]);

  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.current.value, "35");
  assert.equal(changes[0]?.previous.value, "30");
});

test("compares instant facts by reporting date", () => {
  const changes = calculateMetricChanges([
    observation({
      metric: "cash",
      value: "150",
      startDate: null,
      endDate: "2026-06-30",
      filedAt: "2026-07-31",
      accessionNumber: "0000000000-26-000020",
      form: "10-Q",
      concept: "CashAndCashEquivalentsAtCarryingValue",
    }),
    observation({
      metric: "cash",
      value: "120",
      startDate: null,
      endDate: "2026-03-31",
      filedAt: "2026-05-01",
      accessionNumber: "0000000000-26-000010",
      form: "10-Q",
      concept: "CashAndCashEquivalentsAtCarryingValue",
    }),
  ]);

  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.absoluteChange, 30);
});
