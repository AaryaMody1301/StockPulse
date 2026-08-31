import { z } from "zod";
import { normalizeStockSymbol } from "@/lib/symbols";

export const evidenceRelationshipSchema = z.enum([
  "supports",
  "contradicts",
  "qualifies",
  "unresolved",
]);

export const evidenceLinkSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
      message: "Evidence URLs must use http or https",
    }),
  relationship: evidenceRelationshipSchema,
  sourceType: z.enum(["sec", "company", "market", "other"]),
  notes: z.string().max(2000).default(""),
});

const thesisSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(10000),
  assumptions: z.array(z.string().trim().min(1).max(1000)).max(50),
  risks: z.array(z.string().trim().min(1).max(1000)).max(50),
  catalysts: z.array(z.string().trim().min(1).max(1000)).max(50),
  invalidationCriteria: z.array(z.string().trim().min(1).max(1000)).max(50),
  evidenceLinks: z.array(evidenceLinkSchema).max(100),
});

export const thesisRevisionSchema = z.object({
  id: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  note: z.string().trim().max(500),
  snapshot: thesisSnapshotSchema,
});

export const thesisRecordSchema = thesisSnapshotSchema.extend({
  id: z.string().min(1).max(100),
  symbol: z
    .string()
    .transform((value, ctx) => {
      try {
        return normalizeStockSymbol(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid stock symbol" });
        return z.NEVER;
      }
    }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revisions: z.array(thesisRevisionSchema).max(50),
  lastReviewedAt: z.string().datetime().nullable().default(null),
  reviewedEvidenceIds: z.array(z.string().trim().min(1).max(500)).max(250).default([]),
});

export const thesisExportBundleSchema = z.object({
  format: z.literal("stockpulse-thesis-export"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  records: z.array(thesisRecordSchema).max(500),
});

export type EvidenceRelationship = z.infer<typeof evidenceRelationshipSchema>;
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type ThesisRevision = z.infer<typeof thesisRevisionSchema>;
export type ThesisRecord = z.infer<typeof thesisRecordSchema>;
export type ThesisExportBundle = z.infer<typeof thesisExportBundleSchema>;

export type ThesisDraft = Pick<
  ThesisRecord,
  | "symbol"
  | "title"
  | "summary"
  | "assumptions"
  | "risks"
  | "catalysts"
  | "invalidationCriteria"
  | "evidenceLinks"
>;

export const EMPTY_THESIS_DRAFT: ThesisDraft = {
  symbol: "",
  title: "",
  summary: "",
  assumptions: [],
  risks: [],
  catalysts: [],
  invalidationCriteria: [],
  evidenceLinks: [],
};

export function thesisSnapshot(record: ThesisDraft) {
  return thesisSnapshotSchema.parse(record);
}
