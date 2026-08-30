import { z } from "zod";

export const secTickerEntrySchema = z.object({
  cik_str: z.number().int().nonnegative(),
  ticker: z.string().min(1),
  title: z.string().min(1),
});

export const secTickerMapSchema = z.record(z.string(), secTickerEntrySchema);

const recentFilingsSchema = z.object({
  accessionNumber: z.array(z.string()),
  filingDate: z.array(z.string()),
  reportDate: z.array(z.string()),
  acceptanceDateTime: z.array(z.string()),
  form: z.array(z.string()),
  primaryDocument: z.array(z.string()),
});

export const secSubmissionsSchema = z.object({
  cik: z.string(),
  name: z.string(),
  tickers: z.array(z.string()).default([]),
  exchanges: z.array(z.string()).default([]),
  filings: z.object({
    recent: recentFilingsSchema,
    files: z.array(z.unknown()).default([]),
  }),
}).passthrough();

export const secFactUnitSchema = z.object({
  start: z.string().optional(),
  end: z.string(),
  val: z.union([z.number(), z.string()]),
  accn: z.string(),
  fy: z.number().int().optional(),
  fp: z.string().optional(),
  form: z.string(),
  filed: z.string().optional(),
  frame: z.string().optional(),
}).passthrough();

const secConceptSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  units: z.record(z.string(), z.array(secFactUnitSchema)),
}).passthrough();

export const secCompanyFactsSchema = z.object({
  cik: z.number().int().nonnegative(),
  entityName: z.string(),
  facts: z.record(
    z.string(),
    z.record(z.string(), secConceptSchema),
  ),
}).passthrough();

export type SecTickerMapPayload = z.infer<typeof secTickerMapSchema>;
export type SecSubmissionsPayload = z.infer<typeof secSubmissionsSchema>;
export type SecCompanyFactsPayload = z.infer<typeof secCompanyFactsSchema>;
export type SecFactUnitPayload = z.infer<typeof secFactUnitSchema>;

export function parseSecPayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  endpoint: string,
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".") || "payload";
    throw new Error(`SEC ${endpoint} returned invalid data at ${path}: ${issue?.message || "schema mismatch"}`);
  }
  return parsed.data;
}
