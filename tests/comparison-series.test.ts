import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComparisonLineData,
  findCommonComparisonStart,
  type ComparisonSeriesInput,
} from "../src/lib/comparison-series";

const data: ComparisonSeriesInput[] = [
  {
    symbol: "AAA",
    bars: [
      { date: "2026-01-02", close: 100 },
      { date: "2026-01-05", close: 110 },
      { date: "2026-01-06", close: 121 },
    ],
  },
  {
    symbol: "BBB",
    bars: [
      { date: "2026-01-05", close: 200 },
      { date: "2026-01-06", close: 220 },
    ],
  },
];

test("comparison percent mode uses the earliest date shared by every series", () => {
  const start = findCommonComparisonStart(data);
  assert.equal(start, "2026-01-05");

  const first = buildComparisonLineData(data[0]!, "percent", start);
  const second = buildComparisonLineData(data[1]!, "percent", start);

  assert.deepEqual(first.map((point) => [point.time, point.value]), [
    ["2026-01-05", 0],
    ["2026-01-06", 10],
  ]);
  assert.deepEqual(second.map((point) => [point.time, point.value]), [
    ["2026-01-05", 0],
    ["2026-01-06", 10],
  ]);
});

test("comparison returns no percent series when there is no shared date", () => {
  const disjoint: ComparisonSeriesInput[] = [
    { symbol: "AAA", bars: [{ date: "2026-01-02", close: 100 }] },
    { symbol: "BBB", bars: [{ date: "2026-01-03", close: 200 }] },
  ];
  const start = findCommonComparisonStart(disjoint);
  assert.equal(start, null);
  assert.deepEqual(buildComparisonLineData(disjoint[0]!, "percent", start), []);
});
