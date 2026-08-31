import { db } from "@/lib/db";
import { normalizeStockSymbol } from "@/lib/symbols";
import {
  getSecCompanyFacts,
  getSecSubmissionHistory,
  getSecSubmissions,
  getSecTickerMap,
} from "./client";
import {
  normalizeCompanyFacts,
  normalizeSubmissionHistory,
  normalizeSubmissions,
  resolveTickerIdentity,
  type NormalizedSecFiling,
  type SecIdentity,
} from "./normalization";

const MIN_RECENT_RESEARCH_FILINGS = 20;
const MAX_HISTORY_FILES_PER_INGESTION = 2;

function requireDatabase(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for SEC evidence storage");
  }
}

function toDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function dedupeFilings(filings: NormalizedSecFiling[]): NormalizedSecFiling[] {
  const byAccession = new Map<string, NormalizedSecFiling>();
  for (const filing of filings) {
    if (!byAccession.has(filing.accessionNumber)) byAccession.set(filing.accessionNumber, filing);
  }
  return [...byAccession.values()].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
}

async function persistIdentity(identity: SecIdentity) {
  const existing = await db.symbol.findUnique({ where: { ticker: identity.ticker } });
  if (existing) {
    return db.symbol.update({
      where: { id: existing.id },
      data: { cik: identity.cik },
    });
  }
  return db.symbol.create({
    data: {
      ticker: identity.ticker,
      name: identity.title,
      exchange: "Unknown",
      type: "Common Stock",
      cik: identity.cik,
    },
  });
}

export async function resolveSecIdentity(rawSymbol: string): Promise<SecIdentity> {
  requireDatabase();
  const ticker = normalizeStockSymbol(rawSymbol);
  const stored = await db.symbol.findUnique({ where: { ticker } });
  if (stored?.cik) {
    return { cik: stored.cik, ticker, title: stored.name };
  }

  const tickerMap = await getSecTickerMap();
  const identity = resolveTickerIdentity(tickerMap, ticker);
  if (!identity) {
    throw new Error(`No SEC CIK mapping found for ${ticker}`);
  }
  await persistIdentity(identity);
  return identity;
}

export interface SecIngestionSummary {
  symbol: string;
  cik: string;
  status: "success" | "partial";
  filingsStored: number;
  factsStored: number;
  metricsStored: number;
  errors: string[];
}

export async function ingestSecEvidence(rawSymbol: string): Promise<SecIngestionSummary> {
  requireDatabase();
  const symbol = normalizeStockSymbol(rawSymbol);
  const job = await db.jobRun.create({
    data: {
      jobName: `sec-evidence:${symbol}`,
      status: "running",
      metadata: { symbol },
    },
  });

  try {
    const identity = await resolveSecIdentity(symbol);
    const symbolRow = await persistIdentity(identity);

    const [submissionsResult, companyFactsResult] = await Promise.allSettled([
      getSecSubmissions(identity.cik),
      getSecCompanyFacts(identity.cik),
    ]);

    const errors: string[] = [];
    let filings: NormalizedSecFiling[] = [];
    if (submissionsResult.status === "fulfilled") {
      filings = normalizeSubmissions(submissionsResult.value);

      if (
        filings.length < MIN_RECENT_RESEARCH_FILINGS &&
        submissionsResult.value.filings.files.length > 0
      ) {
        const historyFiles = submissionsResult.value.filings.files.slice(0, MAX_HISTORY_FILES_PER_INGESTION);
        const historyResults = await Promise.allSettled(
          historyFiles.map((file) => getSecSubmissionHistory(file.name)),
        );
        historyResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            filings.push(...normalizeSubmissionHistory(identity.cik, result.value));
          } else {
            errors.push(`SEC history ${historyFiles[index]?.name ?? index}: ${errorMessage(result.reason)}`);
          }
        });
      }
      filings = dedupeFilings(filings);
    } else {
      errors.push(errorMessage(submissionsResult.reason));
    }

    const normalizedFacts = companyFactsResult.status === "fulfilled"
      ? normalizeCompanyFacts(companyFactsResult.value)
      : { facts: [], metrics: [] };
    if (companyFactsResult.status === "rejected") {
      errors.push(errorMessage(companyFactsResult.reason));
    }

    if (submissionsResult.status === "rejected" && companyFactsResult.status === "rejected") {
      throw new Error(errors.join("; ") || "SEC submissions and companyfacts requests both failed");
    }

    let filingsStored = 0;
    if (filings.length > 0) {
      const result = await db.secFiling.createMany({
        data: filings.map((filing) => ({
          symbolId: symbolRow.id,
          cik: filing.cik,
          accessionNumber: filing.accessionNumber,
          form: filing.form,
          filedAt: toDate(filing.filedAt)!,
          reportDate: toDate(filing.reportDate),
          acceptedAt: filing.acceptedAt ? new Date(filing.acceptedAt) : null,
          primaryDocument: filing.primaryDocument,
          sourceUrl: filing.sourceUrl,
        })),
        skipDuplicates: true,
      });
      filingsStored = result.count;
    }

    let factsStored = 0;
    if (normalizedFacts.facts.length > 0) {
      const result = await db.secFact.createMany({
        data: normalizedFacts.facts.map((fact) => ({
          factKey: fact.factKey,
          symbolId: symbolRow.id,
          cik: fact.cik,
          taxonomy: fact.taxonomy,
          concept: fact.concept,
          label: fact.label,
          description: fact.description,
          unit: fact.unit,
          value: fact.value,
          startDate: toDate(fact.startDate),
          endDate: toDate(fact.endDate)!,
          filedAt: toDate(fact.filedAt),
          accessionNumber: fact.accessionNumber,
          form: fact.form,
          frame: fact.frame,
          fiscalYear: fact.fiscalYear,
          fiscalPeriod: fact.fiscalPeriod,
        })),
        skipDuplicates: true,
      });
      factsStored = result.count;
    }

    let metricsStored = 0;
    if (normalizedFacts.metrics.length > 0) {
      const result = await db.secMetric.createMany({
        data: normalizedFacts.metrics.map((metric) => ({
          metricKey: metric.metricKey,
          symbolId: symbolRow.id,
          metric: metric.metric,
          value: metric.value,
          unit: metric.unit,
          startDate: toDate(metric.startDate),
          endDate: toDate(metric.endDate)!,
          filedAt: toDate(metric.filedAt),
          accessionNumber: metric.accessionNumber,
          form: metric.form,
          taxonomy: metric.taxonomy,
          concept: metric.concept,
          frame: metric.frame,
          fiscalYear: metric.fiscalYear,
          fiscalPeriod: metric.fiscalPeriod,
        })),
        skipDuplicates: true,
      });
      metricsStored = result.count;
    }

    const status = errors.length === 0 ? "success" : "partial";
    const summary: SecIngestionSummary = {
      symbol,
      cik: identity.cik,
      status,
      filingsStored,
      factsStored,
      metricsStored,
      errors,
    };

    await db.jobRun.update({
      where: { id: job.id },
      data: {
        status,
        endedAt: new Date(),
        error: errors.length > 0 ? errors.join("; ") : null,
        metadata: {
          symbol: summary.symbol,
          cik: summary.cik,
          status: summary.status,
          filingsStored: summary.filingsStored,
          factsStored: summary.factsStored,
          metricsStored: summary.metricsStored,
          errors: summary.errors,
        },
      },
    });

    return summary;
  } catch (error) {
    const message = errorMessage(error);
    await db.jobRun.update({
      where: { id: job.id },
      data: {
        status: "failed",
        endedAt: new Date(),
        error: message,
        metadata: { symbol },
      },
    });
    throw error;
  }
}

export interface StoredSecEvidence {
  symbol: string;
  companyName: string;
  cik: string | null;
  filings: Array<{
    accessionNumber: string;
    form: string;
    filedAt: string;
    reportDate: string | null;
    sourceUrl: string;
  }>;
  metrics: Array<{
    metric: string;
    value: string;
    unit: string;
    startDate: string | null;
    endDate: string;
    filedAt: string | null;
    accessionNumber: string;
    form: string;
    taxonomy: string;
    concept: string;
  }>;
}

export async function getStoredSecEvidence(
  rawSymbol: string,
  filingLimit = 12,
  metricLimit = 80,
): Promise<StoredSecEvidence | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;
  const symbol = normalizeStockSymbol(rawSymbol);
  const row = await db.symbol.findUnique({ where: { ticker: symbol } });
  if (!row) return null;

  const [filings, metrics] = await Promise.all([
    db.secFiling.findMany({
      where: { symbolId: row.id },
      orderBy: [{ filedAt: "desc" }, { accessionNumber: "desc" }],
      take: Math.max(1, Math.min(filingLimit, 50)),
    }),
    db.secMetric.findMany({
      where: { symbolId: row.id },
      orderBy: [{ endDate: "desc" }, { filedAt: "desc" }],
      take: Math.max(1, Math.min(metricLimit, 250)),
    }),
  ]);

  return {
    symbol: row.ticker,
    companyName: row.name,
    cik: row.cik,
    filings: filings.map((filing) => ({
      accessionNumber: filing.accessionNumber,
      form: filing.form,
      filedAt: filing.filedAt.toISOString().slice(0, 10),
      reportDate: filing.reportDate?.toISOString().slice(0, 10) || null,
      sourceUrl: filing.sourceUrl,
    })),
    metrics: metrics.map((metric) => ({
      metric: metric.metric,
      value: metric.value.toString(),
      unit: metric.unit,
      startDate: metric.startDate?.toISOString().slice(0, 10) || null,
      endDate: metric.endDate.toISOString().slice(0, 10),
      filedAt: metric.filedAt?.toISOString().slice(0, 10) || null,
      accessionNumber: metric.accessionNumber,
      form: metric.form,
      taxonomy: metric.taxonomy,
      concept: metric.concept,
    })),
  };
}
