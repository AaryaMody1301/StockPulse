const FALLBACK_APP_URL = "http://localhost:3000";

export function getAppUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || FALLBACK_APP_URL;
  try {
    const url = new URL(configured);
    if (url.protocol === "http:" || url.protocol === "https:") return url;
  } catch {
    // Fall back to a deterministic local URL for build/test environments.
  }
  return new URL(FALLBACK_APP_URL);
}

export function absoluteAppUrl(path = "/"): string {
  return new URL(path, getAppUrl()).toString();
}
