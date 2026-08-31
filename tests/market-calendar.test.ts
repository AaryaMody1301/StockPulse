import assert from "node:assert/strict";
import test from "node:test";
import { getUsMarketStatus } from "../src/lib/market-calendar";

test("NYSE holiday is reported closed during regular session hours", () => {
  // Labor Day 2026, 11:00 a.m. ET.
  assert.equal(getUsMarketStatus(new Date("2026-09-07T15:00:00.000Z")), "closed");
});

test("normal weekday is reported open during the core session", () => {
  // Tuesday after Labor Day 2026, 11:00 a.m. ET.
  assert.equal(getUsMarketStatus(new Date("2026-09-08T15:00:00.000Z")), "open");
});

test("published early close switches to after-hours at 1 p.m. ET", () => {
  // Day after Thanksgiving 2026, 2:00 p.m. ET.
  assert.equal(getUsMarketStatus(new Date("2026-11-27T19:00:00.000Z")), "after-hours");
});

test("weekend remains closed", () => {
  assert.equal(getUsMarketStatus(new Date("2026-09-05T15:00:00.000Z")), "closed");
});
