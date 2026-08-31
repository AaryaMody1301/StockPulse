import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSearchResults } from "../src/lib/providers";

test("provider search results keep only supported normalized stock symbols", () => {
  const results = normalizeSearchResults([
    { symbol: "aapl", name: "Apple", type: "Common Stock", exchange: "US" },
    { symbol: "AAPL", name: "Apple duplicate", type: "Common Stock", exchange: "US" },
    { symbol: "../evil", name: "Invalid", type: "Common Stock", exchange: "US" },
    { symbol: "BRK.B", name: "Berkshire Hathaway", type: "Common Stock", exchange: "US" },
  ]);

  assert.deepEqual(results.map((result) => result.symbol), ["AAPL", "BRK.B"]);
});
