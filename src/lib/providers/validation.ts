import { z } from "zod";

const finiteNumber = z.number().finite();
const numericValue = z.union([z.string(), z.number()]);

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .refine(isHttpUrl, { message: "Expected an HTTP(S) URL" });

const optionalHttpUrlSchema = z.union([z.literal(""), httpUrlSchema]);

export const finnhubQuoteSchema = z.object({
  c: finiteNumber,
  d: finiteNumber,
  dp: finiteNumber,
  h: finiteNumber,
  l: finiteNumber,
  o: finiteNumber,
  pc: finiteNumber,
  t: finiteNumber,
});

export const finnhubSearchSchema = z.object({
  count: finiteNumber.optional(),
  result: z.array(
    z.object({
      description: z.string(),
      displaySymbol: z.string().optional(),
      symbol: z.string(),
      type: z.string(),
    }),
  ),
});

export const finnhubProfileSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  logo: optionalHttpUrlSchema.default(""),
  finnhubIndustry: z.string().default(""),
  marketCapitalization: finiteNumber.default(0),
  weburl: optionalHttpUrlSchema.default(""),
  country: z.string().default(""),
  currency: z.string().default(""),
});

export const finnhubCandleSchema = z.object({
  c: z.array(finiteNumber).optional(),
  h: z.array(finiteNumber).optional(),
  l: z.array(finiteNumber).optional(),
  o: z.array(finiteNumber).optional(),
  v: z.array(finiteNumber).optional(),
  t: z.array(finiteNumber).optional(),
  s: z.string(),
}).superRefine((value, ctx) => {
  if (value.s === "no_data") return;
  const arrays = [value.c, value.h, value.l, value.o, value.v, value.t];
  if (arrays.some((item) => !item)) {
    ctx.addIssue({ code: "custom", message: "Finnhub candle payload is incomplete" });
    return;
  }
  const lengths = arrays.map((item) => item!.length);
  if (!lengths.every((length) => length === lengths[0])) {
    ctx.addIssue({ code: "custom", message: "Finnhub candle arrays have mismatched lengths" });
  }
});

export const finnhubNewsSchema = z.array(
  z.object({
    headline: z.string(),
    summary: z.string().default(""),
    source: z.string(),
    url: httpUrlSchema,
    image: optionalHttpUrlSchema.default(""),
    category: z.string().default("general"),
    datetime: finiteNumber,
  }),
);

export const twelveDataQuoteSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().optional(),
  exchange: z.string().optional(),
  close: numericValue,
  change: numericValue,
  percent_change: numericValue,
  volume: numericValue.optional().default("0"),
  high: numericValue,
  low: numericValue,
  open: numericValue,
  previous_close: numericValue,
  timestamp: numericValue,
});

// Keep provider result arrays required. Twelve Data can return logical error
// payloads with HTTP 200; a missing `data`/`values` field must therefore fail
// validation rather than masquerading as a legitimate empty result.
export const twelveDataSearchSchema = z.object({
  data: z.array(
    z.object({
      symbol: z.string(),
      instrument_name: z.string(),
      instrument_type: z.string(),
      exchange: z.string(),
    }),
  ),
});

export const twelveDataTimeSeriesSchema = z.object({
  values: z.array(
    z.object({
      datetime: z.string(),
      open: numericValue,
      high: numericValue,
      low: numericValue,
      close: numericValue,
      volume: numericValue.optional().default("0"),
    }),
  ),
});

export function parseFiniteNumber(value: string | number, field: string): number {
  if (typeof value === "string" && value.trim() === "") {
    throw new Error(`Invalid numeric value for ${field}`);
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${field}`);
  }
  return parsed;
}

export function parseProviderPayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  provider: string,
  endpoint: string,
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? "invalid response";
    throw new Error(`${provider} ${endpoint} returned an invalid payload: ${issue}`);
  }
  return parsed.data;
}
