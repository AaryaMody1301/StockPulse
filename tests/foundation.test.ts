import test from "node:test";
import assert from "node:assert/strict";
import { classifyJobRun } from "../src/lib/jobs";
import { getClientIp } from "../src/lib/request";

test("classifyJobRun distinguishes complete, partial, and failed runs", () => {
  assert.equal(classifyJobRun(10, 10), "success");
  assert.equal(classifyJobRun(10, 6), "partial");
  assert.equal(classifyJobRun(10, 0), "failed");
});

test("classifyJobRun rejects impossible counts", () => {
  assert.throws(() => classifyJobRun(0, 0), /positive integer/);
  assert.throws(() => classifyJobRun(2, 3), /between 0 and total/);
});

test("getClientIp prefers reverse-proxy X-Real-IP", () => {
  const values = new Map([
    ["x-real-ip", "203.0.113.10"],
    ["x-forwarded-for", "198.51.100.5, 203.0.113.10"],
  ]);
  assert.equal(getClientIp({ get: (name) => values.get(name) ?? null }), "203.0.113.10");
});

test("getClientIp falls back to first forwarded address", () => {
  const values = new Map([["x-forwarded-for", "198.51.100.5, 203.0.113.10"]]);
  assert.equal(getClientIp({ get: (name) => values.get(name) ?? null }), "198.51.100.5");
});
