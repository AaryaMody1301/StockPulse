import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeConfigurationStatus } from "../src/lib/runtime-config";

test("runtime readiness reports missing core configuration without exposing values", () => {
  const status = getRuntimeConfigurationStatus({});
  assert.deepEqual(status, {
    databaseConfigured: false,
    marketDataConfigured: false,
    marketProviders: [],
    secIngestionConfigured: false,
    aiConfigured: false,
    appUrlConfigured: false,
  });
});

test("one configured market provider is sufficient for market-data readiness", () => {
  const status = getRuntimeConfigurationStatus({
    DATABASE_URL: "postgresql://example",
    FINNHUB_API_KEY: "secret",
  });
  assert.equal(status.databaseConfigured, true);
  assert.equal(status.marketDataConfigured, true);
  assert.deepEqual(status.marketProviders, ["finnhub"]);
});

test("SEC placeholder identity is not treated as deployment-ready", () => {
  assert.equal(
    getRuntimeConfigurationStatus({
      SEC_USER_AGENT: "StockPulse Research contact@example.com",
    }).secIngestionConfigured,
    false,
  );

  assert.equal(
    getRuntimeConfigurationStatus({
      SEC_USER_AGENT: "StockPulse Research ops@company.com",
    }).secIngestionConfigured,
    true,
  );
});

test("optional AI requires both a key and a model", () => {
  assert.equal(
    getRuntimeConfigurationStatus({ AI_GATEWAY_API_KEY: "secret" }).aiConfigured,
    false,
  );
  assert.equal(
    getRuntimeConfigurationStatus({
      AI_API_KEY: "secret",
      AI_MODEL: "provider/model",
    }).aiConfigured,
    true,
  );
});
