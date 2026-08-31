import assert from "node:assert/strict";
import test from "node:test";
import {
  getUsMarketStatus,
  isUsMarketTradingDate,
  latestCompletedUsMarketSessionDate,
  nearestUsMarketTradingDate,
} from "../src/lib/market-calendar";

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

test("trading-date helper rejects holidays and weekends", () => {
  assert.equal(isUsMarketTradingDate("2026-09-07"), false);
  assert.equal(isUsMarketTradingDate("2026-09-05"), false);
  assert.equal(isUsMarketTradingDate("2026-09-08"), true);
});

test("nearest trading date rolls a holiday back to the prior session", () => {
  assert.equal(nearestUsMarketTradingDate("2026-09-07", -1), "2026-09-04");
});

test("latest completed session stays on Friday before Monday's close", () => {
  // Monday Aug. 31, 2026 at 9:00 a.m. ET.
  assert.equal(
    latestCompletedUsMarketSessionDate(new Date("2026-08-31T13:00:00.000Z")),
    "2026-08-28",
  );
});

test("latest completed session advances after the normal close", () => {
  // Monday Aug. 31, 2026 at 5:00 p.m. ET.
  assert.equal(
    latestCompletedUsMarketSessionDate(new Date("2026-08-31T21:00:00.000Z")),
    "2026-08-31",
  );
});

test("latest completed session honors the published early close", () => {
  // Friday after Thanksgiving 2026 at 1:30 p.m. ET.
  assert.equal(
    latestCompletedUsMarketSessionDate(new Date("2026-11-27T18:30:00.000Z")),
    "2026-11-27",
  );
});
