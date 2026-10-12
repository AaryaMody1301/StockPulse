import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function fail(message) {
  console.error(`[production-audit] ${message}`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Unable to read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const lock = readJson("package-lock.json");
if (!isObject(lock) || !isObject(lock.packages)) {
  fail("package-lock.json must contain a packages object");
}
const lockPackages = lock.packages;
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  fail("npm CLI path is unavailable; run this check with npm run audit:production");
}
const result = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  timeout: 120_000,
  windowsHide: true,
});

if (result.error) {
  fail(`Unable to run npm audit: ${result.error.message}`);
}
if (result.signal || (result.status !== 0 && result.status !== 1)) {
  fail(`npm audit did not complete: ${result.signal ?? `exit status ${result.status}`}`);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  if (result.stderr) process.stderr.write(result.stderr);
  fail(`npm audit did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}
if (isObject(report) && report.error) {
  if (result.stderr) process.stderr.write(result.stderr);
  fail("npm audit failed to retrieve advisory data");
}
if (!isObject(report) || report.auditReportVersion !== 2 || !isObject(report.vulnerabilities)) {
  fail("npm audit did not return a complete version 2 vulnerability report");
}

function lockEntryIsDevOnly(path) {
  const entry = lockPackages[path];
  return Boolean(entry && (entry.dev === true || entry.devOptional === true));
}

const ignored = [];
const blockers = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
  if (!isObject(vulnerability) || typeof vulnerability.severity !== "string" || !Object.hasOwn(severityRank, vulnerability.severity)) {
    fail(`npm audit returned an invalid vulnerability entry for ${name}`);
  }
  if (vulnerability.nodes !== undefined && (
    !Array.isArray(vulnerability.nodes) ||
    vulnerability.nodes.some((node) => typeof node !== "string" || !node.startsWith("node_modules/"))
  )) {
    fail(`npm audit returned invalid package paths for ${name}`);
  }
  const severity = vulnerability.severity;
  if (severityRank[severity] < severityRank.high) continue;

  const nodes = Array.isArray(vulnerability?.nodes) && vulnerability.nodes.length > 0
    ? vulnerability.nodes
    : [`node_modules/${name}`];

  const devOnly = nodes.every(lockEntryIsDevOnly);
  const item = {
    name,
    severity,
    nodes,
  };

  if (devOnly) ignored.push(item);
  else blockers.push(item);
}

if (ignored.length > 0) {
  console.log("[production-audit] Ignoring high/critical advisories confined to dev/devOptional lockfile entries:");
  for (const item of ignored) {
    console.log(`  - ${item.name} (${item.severity}): ${item.nodes.join(", ")}`);
  }
}

if (blockers.length > 0) {
  console.error("[production-audit] High/critical vulnerabilities are reachable from non-dev runtime packages:");
  for (const item of blockers) {
    console.error(`  - ${item.name} (${item.severity}): ${item.nodes.join(", ")}`);
  }
  process.exit(1);
}

console.log("[production-audit] No high/critical vulnerabilities are reachable from required runtime packages.");
