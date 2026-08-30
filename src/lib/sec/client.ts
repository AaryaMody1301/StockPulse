import {
  parseSecPayload,
  secCompanyFactsSchema,
  secSubmissionHistorySchema,
  secSubmissionsSchema,
  secTickerMapSchema,
  type SecCompanyFactsPayload,
  type SecSubmissionHistoryPayload,
  type SecSubmissionsPayload,
  type SecTickerMapPayload,
} from "./validation";
import { normalizeCik } from "./normalization";

const SEC_DATA_BASE = "https://data.sec.gov";
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const MIN_REQUEST_INTERVAL_MS = 150;
const REQUEST_TIMEOUT_MS = 10_000;
const TICKER_CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 30_000;

let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;
let tickerCache: { expiresAt: number; payload: SecTickerMapPayload } | null = null;

class SecHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null,
  ) {
    super(message);
    this.name = "SecHttpError";
  }
}

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

export function calculateSecRetryDelayMs(
  retryAfter: string | null,
  attempt: number,
  now = Date.now(),
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(MAX_RETRY_AFTER_MS, Math.round(seconds * 1000));
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, date - now));
    }
  }
  return Math.min(MAX_RETRY_AFTER_MS, 500 * (2 ** Math.max(0, attempt - 1)));
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof SecHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  return error instanceof Error && (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError
  );
}

async function fetchSecJson<T>(
  url: string,
  endpoint: string,
  schema: Parameters<typeof parseSecPayload<T>>[0],
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await scheduleSecRequest(async () => {
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
            throw new SecHttpError(
              `SEC ${endpoint} request failed with HTTP ${response.status}`,
              response.status,
              response.headers.get("retry-after"),
            );
          }
          const payload: unknown = await response.json();
          return parseSecPayload(schema, payload, endpoint);
        } finally {
          clearTimeout(timeout);
        }
      });
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS || !shouldRetry(error)) throw error;
      const retryAfter = error instanceof SecHttpError ? error.retryAfter : null;
      const waitMs = calculateSecRetryDelayMs(retryAfter, attempt);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`SEC ${endpoint} request failed`);
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

export async function getSecSubmissionHistory(
  fileName: string,
): Promise<SecSubmissionHistoryPayload> {
  if (!/^CIK\d{10}-submissions-\d{3}\.json$/.test(fileName)) {
    throw new Error("Invalid SEC submission history filename");
  }
  return fetchSecJson(
    `${SEC_DATA_BASE}/submissions/${fileName}`,
    `submissions/${fileName}`,
    secSubmissionHistorySchema,
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
