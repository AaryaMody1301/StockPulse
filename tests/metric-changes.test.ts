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

test("calculates deterministic period-over-period increase", () => {
  const changes = calculateMetricChanges([
    observation({ value: "120", endDate: "2025-12-31" }),
    observation({ value: "100", endDate: "2024-12-31", accessionNumber: "0000000000-25-000001" }),
  ]);

  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.absoluteChange, 20);
  assert.equal(changes[0]?.percentChange, 20);
  assert.equal(changes[0]?.direction, "increase");
});

test("uses the latest filing for duplicate metric periods", () => {
  const changes = calculateMetricChanges([
    observation({ value: "110", filedAt: "2026-01-15", accessionNumber: "0000000000-26-000001" }),
    observation({ value: "120", filedAt: "2026-02-15", accessionNumber: "0000000000-26-000002" }),
    observation({ value: "100", endDate: "2024-12-31", filedAt: "2025-02-01", accessionNumber: "0000000000-25-000001" }),
  ]);

  assert.equal(changes[0]?.current.value, "120");
  assert.equal(changes[0]?.current.accessionNumber, "0000000000-26-000002");
});

test("returns null percentage when the previous period is zero", () => {
  const changes = calculateMetricChanges([
    observation({ value: "25", endDate: "2025-12-31" }),
    observation({ value: "0", endDate: "2024-12-31", accessionNumber: "0000000000-25-000001" }),
  ]);

  assert.equal(changes[0]?.absoluteChange, 25);
  assert.equal(changes[0]?.percentChange, null);
});

test("does not compare observations with different units", () => {
  const changes = calculateMetricChanges([
    observation({ value: "120", unit: "USD", endDate: "2025-12-31" }),
    observation({ value: "100", unit: "EUR", endDate: "2024-12-31" }),
  ]);

  assert.equal(changes.length, 0);
});
