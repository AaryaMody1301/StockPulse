import type { Headers } from "undici";

/**
 * Resolve the best client IP signal available from the reverse proxy.
 * Nginx is configured to set X-Real-IP from the socket remote address.
 */
export function getClientIp(headers: Pick<Headers, "get">): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}
