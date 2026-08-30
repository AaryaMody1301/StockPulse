import type { GroundingBundle, GroundingEvidence } from "@/lib/ai/grounding";
import type { ThesisDraft, ThesisRecord } from "./schema";

export interface ResearchCompleteness {
  score: number;
  missing: string[];
  unresolvedEvidence: number;
}

export interface ReviewDelta {
  status: "never-reviewed" | "up-to-date" | "changes-pending";
  newEvidence: GroundingEvidence[];
  counts: { filing: number; metric: number; change: number };
}

export function assessResearchCompleteness(draft: ThesisDraft): ResearchCompleteness {
  const checks = [
    [draft.title.trim().length > 0, "title"],
    [draft.summary.trim().length >= 80, "falsifiable core thesis"],
    [draft.assumptions.length > 0, "assumptions"],
    [draft.risks.length > 0, "risks"],
    [draft.invalidationCriteria.length > 0, "invalidation criteria"],
    [draft.evidenceLinks.length > 0, "evidence"],
  ] as const;
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
  const unresolvedEvidence = draft.evidenceLinks.filter((item) => item.relationship === "unresolved").length;
  return { score, missing, unresolvedEvidence };
}

export function calculateReviewDelta(
  record: Pick<ThesisRecord, "lastReviewedAt" | "reviewedEvidenceIds">,
  bundle: GroundingBundle,
): ReviewDelta {
  const reviewed = new Set(record.reviewedEvidenceIds);
  const newEvidence = bundle.evidence.filter((item) => !reviewed.has(item.id));
  const counts = newEvidence.reduce(
    (acc, item) => {
      acc[item.kind] += 1;
      return acc;
    },
    { filing: 0, metric: 0, change: 0 },
  );

  return {
    status: !record.lastReviewedAt
      ? "never-reviewed"
      : newEvidence.length > 0
        ? "changes-pending"
        : "up-to-date",
    newEvidence,
    counts,
  };
}
