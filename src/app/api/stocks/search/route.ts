import { NextRequest, NextResponse } from "next/server";
import { marketData } from "@/lib/providers";
import { z } from "zod";
import { REVALIDATE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

const querySchema = z.object({
  q: z.string().trim().min(1).max(50),
});

export async function GET(request: NextRequest) {
  const limited = rateLimit(getClientIp(request.headers));
  if (limited) return limited;

  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid query parameter 'q'." },
      { status: 400 },
    );
  }

  try {
    const results = await marketData.searchSymbol(parsed.data.q);
    return NextResponse.json(
      { data: results },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${REVALIDATE.search}, stale-while-revalidate=${REVALIDATE.search * 2}`,
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
