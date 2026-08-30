import { NextResponse } from "next/server";

const hits = new Map<string, number[]>();
const MAX_TRACKED_CLIENTS = 10_000;

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Production currently runs one web process. This state is not coordinated
 * across multiple processes; see docs/OPERATIONS.md before scaling out.
 */
export function rateLimit(
  ip: string,
  { windowMs = 60_000, max = 60 } = {},
): NextResponse | null {
  const now = Date.now();
  const timestamps = hits.get(ip) ?? [];
  const windowStart = now - windowMs;
  const recent = timestamps.filter((timestamp) => timestamp > windowStart);

  if (!hits.has(ip) && hits.size >= MAX_TRACKED_CLIENTS) {
    const oldestKey = hits.keys().next().value;
    if (oldestKey !== undefined) hits.delete(oldestKey);
  }

  if (recent.length >= max) {
    hits.set(ip, recent);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
      },
    );
  }

  recent.push(now);
  hits.set(ip, recent);
  return null;
}
