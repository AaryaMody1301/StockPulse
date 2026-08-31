import assert from "node:assert/strict";
import test from "node:test";
import { hasDailyCoverage } from "../src/lib/market/coverage";

test("pre-market coverage accepts the prior completed session", () => {
  assert.equal(
    hasDailyCoverage(
      ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"],
      "2026-08-24",
      "2026-08-31",
      new Date("2026-08-31T13:00:00.000Z"),
    ),
    true,
  );
});

test("after close coverage rejects a history missing today's completed session", () => {
  assert.equal(
    hasDailyCoverage(
      ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"],
      "2026-08-24",
      "2026-08-31",
      new Date("2026-08-31T21:00:00.000Z"),
    ),
    false,
  );
});

test("weekend coverage requires the latest Friday session rather than the weekend date", () => {
  assert.equal(
    hasDailyCoverage(
      ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
      "2026-08-31",
      "2026-09-06",
      new Date("2026-09-06T15:00:00.000Z"),
    ),
    true,
  );
});

test("holiday-ended historical ranges target the prior trading session", () => {
  assert.equal(
    hasDailyCoverage(
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
      "2026-09-01",
      "2026-09-07",
      new Date("2026-09-08T21:00:00.000Z"),
    ),
    true,
  );
});

test("range coverage still rejects an excessively late starting point", () => {
  assert.equal(
    hasDailyCoverage(
      ["2026-08-20", "2026-08-21"],
      "2026-08-01",
      "2026-08-21",
      new Date("2026-08-24T21:00:00.000Z"),
    ),
    false,
  );
});
