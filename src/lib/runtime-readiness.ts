import { db } from "@/lib/db";

let databaseReadinessCache: { checkedAt: number; reachable: boolean } | null = null;
const DATABASE_READINESS_CACHE_MS = 5_000;

export async function isDatabaseReachable(nowMs = Date.now()): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;

  if (
    databaseReadinessCache
    && nowMs - databaseReadinessCache.checkedAt >= 0
    && nowMs - databaseReadinessCache.checkedAt < DATABASE_READINESS_CACHE_MS
  ) {
    return databaseReadinessCache.reachable;
  }

  let reachable = false;
  try {
    await db.$queryRaw`SELECT 1`;
    reachable = true;
  } catch {
    reachable = false;
  }

  databaseReadinessCache = { checkedAt: nowMs, reachable };
  return reachable;
}
