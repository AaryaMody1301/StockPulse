import assert from "node:assert/strict";
import test from "node:test";
import { buildFinnhubRequest } from "../src/lib/providers/finnhub";

test("Finnhub requests authenticate with a header instead of the URL", () => {
  const apiKey = "secret-test-key";
  const request = buildFinnhubRequest("/quote", { symbol: "AAPL" }, apiKey);
  const url = new URL(request.url);

  assert.equal(url.searchParams.get("symbol"), "AAPL");
  assert.equal(url.searchParams.has("token"), false);
  assert.equal(request.url.includes(apiKey), false);
  assert.equal(request.headers["X-Finnhub-Token"], apiKey);
});
