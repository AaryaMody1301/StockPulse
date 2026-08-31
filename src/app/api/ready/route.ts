import { NextResponse } from "next/server";
import {
  getRuntimeConfigurationStatus,
  isDatabaseReachable,
} from "@/lib/runtime-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const configuration = getRuntimeConfigurationStatus();
  const databaseReachable = configuration.databaseConfigured
    ? await isDatabaseReachable()
    : false;
  const ready = databaseReachable && configuration.marketDataConfigured;

  return NextResponse.json(
    {
      status: ready ? "ready" : "not-ready",
      service: "stockpulse-web",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          configured: configuration.databaseConfigured,
          reachable: databaseReachable,
        },
        marketData: {
          configured: configuration.marketDataConfigured,
          providers: configuration.marketProviders,
        },
        secIngestion: {
          configured: configuration.secIngestionConfigured,
          requiredForWebReadiness: false,
        },
        optionalAi: {
          configured: configuration.aiConfigured,
          requiredForWebReadiness: false,
        },
        appUrl: {
          configured: configuration.appUrlConfigured,
          requiredForWebReadiness: false,
        },
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
