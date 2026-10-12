import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test, { after } from "node:test";

const directory = mkdtempSync(join(tmpdir(), "stockpulse audit "));
const script = resolve("scripts/audit-production.mjs");
const npmCli = join(directory, "fake npm.cjs");
const preload = join(directory, "spawn-stub.cjs");
const invocation = join(directory, "invocation.json");
const success = "No high/critical vulnerabilities";

writeFileSync(join(directory, "package-lock.json"), JSON.stringify({
  packages: {
    "node_modules/tool": { dev: true },
    "node_modules/optional-tool": { devOptional: true },
    "node_modules/runtime": {},
  },
}));
writeFileSync(npmCli, `
  require("node:fs").writeFileSync(process.env.STOCKPULSE_AUDIT_INVOCATION,
    JSON.stringify({ executable: process.execPath, args: process.argv.slice(2) }));
  process.stdout.write(process.env.STOCKPULSE_AUDIT_OUTPUT);
  process.exit(Number(process.env.STOCKPULSE_AUDIT_STATUS));
`);
writeFileSync(preload, `
  const assert = require("node:assert/strict");
  require("node:child_process").spawnSync = (command, args, options) => {
    assert.equal(command, process.execPath);
    assert.deepEqual(args, [process.env.npm_execpath, "audit", "--omit=dev", "--json"]);
    assert.equal(options.timeout, 120000);
    assert.equal(options.windowsHide, true);
    assert.equal(options.shell, undefined);
    return JSON.parse(process.env.STOCKPULSE_AUDIT_SPAWN_RESULT);
  };
  require("node:module").syncBuiltinESMExports();
`);
after(() => rmSync(directory, { recursive: true, force: true }));

function audit(output: unknown, status = 0, spawnResult?: object, cli = npmCli) {
  return spawnSync(process.execPath, [
    ...(spawnResult ? ["--require", preload] : []), script,
  ], {
    cwd: directory,
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
    env: {
      ...process.env,
      npm_execpath: cli,
      STOCKPULSE_AUDIT_INVOCATION: invocation,
      STOCKPULSE_AUDIT_OUTPUT: typeof output === "string" ? output : JSON.stringify(output),
      STOCKPULSE_AUDIT_STATUS: String(status),
      STOCKPULSE_AUDIT_SPAWN_RESULT: JSON.stringify(spawnResult ?? {}),
    },
  });
}

function report(nodes: string[], severity = "high") {
  return { auditReportVersion: 2, vulnerabilities: { tool: { severity, nodes } } };
}

test("production audit runs the npm JavaScript CLI through Node, including paths with spaces", () => {
  const result = audit({ auditReportVersion: 2, vulnerabilities: {} });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(success));
  assert.deepEqual(JSON.parse(readFileSync(invocation, "utf8")), {
    executable: process.execPath,
    args: ["audit", "--omit=dev", "--json"],
  });
});

test("production audit blocks high/critical runtime, mixed, and unknown package paths", () => {
  for (const nodes of [
    ["node_modules/runtime"],
    ["node_modules/tool", "node_modules/runtime"],
    ["node_modules/not-in-lockfile"],
  ]) {
    for (const severity of ["high", "critical"]) {
      const result = audit(report(nodes, severity), 1);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /reachable from non-dev runtime packages/);
      assert.doesNotMatch(result.stdout, new RegExp(success));
    }
  }
});

test("production audit preserves dev/devOptional exclusions and its severity threshold", () => {
  for (const [nodes, severity] of [
    [["node_modules/tool", "node_modules/optional-tool"], "critical"],
    [["node_modules/runtime"], "moderate"],
  ] as const) {
    const result = audit(report([...nodes], severity), 1);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(success));
  }
});

test("production audit rejects error, empty, incomplete, and malformed reports", () => {
  for (const output of [
    "", "not JSON", null, [], {},
    { error: { code: "E503", summary: "service unavailable" } },
    { auditReportVersion: 2 },
    { auditReportVersion: 2, vulnerabilities: [] },
    { auditReportVersion: 3, vulnerabilities: {} },
    { auditReportVersion: 2, vulnerabilities: { tool: {} } },
    { auditReportVersion: 2, vulnerabilities: { tool: { severity: "unknown" } } },
    { auditReportVersion: 2, vulnerabilities: { tool: { severity: "high", nodes: [42] } } },
  ]) {
    const result = audit(output, 1);
    assert.equal(result.status, 1, result.stderr);
    assert.doesNotMatch(result.stdout, new RegExp(success));
  }
});

test("production audit fails on process errors, signals, timeouts, and unexpected exits", () => {
  for (const spawnResult of [
    { error: { message: "spawn failed", code: "ENOENT" } },
    { error: { message: "audit timed out", code: "ETIMEDOUT" } },
    { signal: "SIGTERM", status: null },
    { status: 2, stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }) },
  ]) {
    const result = audit("", 0, spawnResult);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Unable to run npm audit|npm audit did not complete/);
    assert.doesNotMatch(result.stdout, new RegExp(success));
  }
});

test("production audit explains the required npm script when its CLI path is missing", () => {
  const result = audit("", 0, undefined, "");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm run audit:production/);
  assert.doesNotMatch(result.stdout, new RegExp(success));
});
