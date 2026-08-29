import {
  parseSecPayload,
  secCompanyFactsSchema,
  secSubmissionsSchema,
  secTickerMapSchema,
  type SecCompanyFactsPayload,
  type SecSubmissionsPayload,
  type SecTickerMapPayload,
} from "./validation";
import { normalizeCik } from "./normalization";

const SEC_DATA_BASE = "https://data.sec.gov";
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const MIN_REQUEST_INTERVAL_MS = 150;
const REQUEST_TIMEOUT_MS = 10_000;
const TICKER_CACHE_MS = 6 * 60 * 60 * 1000;

let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;
let tickerCache: { expiresAt: number; payload: SecTickerMapPayload } | null = null;

function getUserAgent(): string {
  const value = process.env.SEC_USER_AGENT?.trim();
  if (!value) {
    throw new Error(
      "SEC_USER_AGENT is required for SEC automated access. Set a descriptive app/company name and contact address.",
    );
  }
  return value;
}

async function scheduleSecRequest<T>(request: () => Promise<T>): Promise<T> {
  let releaseQueue: () => void = () => {};
  const previous = requestQueue;
  requestQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });

  await previous;
  try {
    const waitMs = Math.max(0, nextRequestAt - Date.now());
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
    return await request();
  } finally {
    releaseQueue();
  }
}

async function fetchSecJson<T>(
  url: string,
  endpoint: string,
  schema: Parameters<typeof parseSecPayload<T>>[0],
): Promise<T> {
  return scheduleSecRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": getUserAgent(),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`SEC ${endpoint} request failed with HTTP ${response.status}`);
      }
      const payload: unknown = await response.json();
      return parseSecPayload(schema, payload, endpoint);
    } finally {
      clearTimeout(timeout);
    }
  });
}

export async function getSecTickerMap(): Promise<SecTickerMapPayload> {
  if (tickerCache && tickerCache.expiresAt > Date.now()) {
    return tickerCache.payload;
  }
  const payload = await fetchSecJson(
    SEC_TICKERS_URL,
    "company_tickers.json",
    secTickerMapSchema,
  );
  tickerCache = { payload, expiresAt: Date.now() + TICKER_CACHE_MS };
  return payload;
}

export async function getSecSubmissions(cik: string): Promise<SecSubmissionsPayload> {
  const normalized = normalizeCik(cik);
  return fetchSecJson(
    `${SEC_DATA_BASE}/submissions/CIK${normalized}.json`,
    "submissions",
    secSubmissionsSchema,
  );
}

export async function getSecCompanyFacts(cik: string): Promise<SecCompanyFactsPayload> {
  const normalized = normalizeCik(cik);
  return fetchSecJson(
    `${SEC_DATA_BASE}/api/xbrl/companyfacts/CIK${normalized}.json`,
    "companyfacts",
    secCompanyFactsSchema,
  );
}
