export type JobRunStatus = "success" | "partial" | "failed";

export function classifyJobRun(total: number, succeeded: number): JobRunStatus {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error("total must be a positive integer");
  }
  if (!Number.isInteger(succeeded) || succeeded < 0 || succeeded > total) {
    throw new Error("succeeded must be an integer between 0 and total");
  }

  if (succeeded === total) return "success";
  if (succeeded === 0) return "failed";
  return "partial";
}
