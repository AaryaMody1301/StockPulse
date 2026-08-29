import { createHash } from "node:crypto";
import type {
  SecCompanyFactsPayload,
  SecFactUnitPayload,
  SecSubmissionsPayload,
  SecTickerMapPayload,
} from "./validation";

const SUPPORTED_FORMS = new Set([
  "10-K",
  "10-K/A",
  "10-Q",
  "10-Q/A",
  "8-K",
  "8-K/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
  "6-K",
  "6-K/A",
]);

interface MetricDefinition {
  metric: string;
  taxonomy: string;
  concepts: string[];
  preferredUnits: string[];
}

export const SEC_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    metric: "revenue",
    taxonomy: "us-gaap",
    concepts: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "SalesRevenueNet",
      "Revenues",
    ],
    preferredUnits: ["USD"],
  },
  {
    metric: "net_income",
    taxonomy: "us-gaap",
    concepts: ["NetIncomeLoss"],
    preferredUnits: ["USD"],
  },
  {
    metric: "eps",
    taxonomy: "us-gaap",
    concepts: ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    preferredUnits: ["USD/shares", "USD / shares"],
  },
  {
    metric: "cash",
    taxonomy: "us-gaap",
    concepts: [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
    preferredUnits: ["USD"],
  },
  {
    metric: "debt",
    taxonomy: "us-gaap",
    concepts: ["LongTermDebtAndFinanceLeaseObligations", "LongTermDebt"],
    preferredUnits: ["USD"],
  },
  {
    metric: "shares",
    taxonomy: "dei",
    concepts: ["EntityCommonStockSharesOutstanding"],
    preferredUnits: ["shares"],
  },
  {
    metric: "operating_cash_flow",
    taxonomy: "us-gaap",
    concepts: ["NetCashProvidedByUsedInOperatingActivities"],
    preferredUnits: ["USD"],
  },
  {
    metric: "capex",
    taxonomy: "us-gaap",
    concepts: ["PaymentsToAcquirePropertyPlantAndEquipment"],
    preferredUnits: ["USD"],
  },
];

export interface SecIdentity {
  cik: string;
  ticker: string;
  title: string;
}

export interface NormalizedSecFiling {
  cik: string;
  accessionNumber: string;
  form: string;
  filedAt: string;
  reportDate: string | null;
  acceptedAt: string | null;
  primaryDocument: string | null;
  sourceUrl: string;
}

export interface NormalizedSecFact {
  factKey: string;
  cik: string;
  taxonomy: string;
  concept: string;
  label: string | null;
  description: string | null;
  unit: string;
  value: string;
  startDate: string | null;
  endDate: string;
  filedAt: string | null;
  accessionNumber: string;
  form: string;
  frame: string | null;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
}

export interface NormalizedSecMetric {
  metricKey: string;
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
  frame: string | null;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
}

export function normalizeCik(value: string | number): string {
  const digits = String(value).replace(/\D/g, "");
  if (!digits || digits.length > 10) {
    throw new Error(`Invalid SEC CIK: ${value}`);
  }
  return digits.padStart(10, "0");
}

export function resolveTickerIdentity(
  payload: SecTickerMapPayload,
  rawTicker: string,
): SecIdentity | null {
  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) return null;
  for (const entry of Object.values(payload)) {
    if (entry.ticker.trim().toUpperCase() === ticker) {
      return {
        cik: normalizeCik(entry.cik_str),
        ticker,
        title: entry.title.trim(),
      };
    }
  }
  return null;
}

function cleanDate(value: string | undefined): string | null {
  const date = value?.trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : date;
}

function cleanDateTime(value: string | undefined): string | null {
  const date = value?.trim();
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stableKey(parts: Array<string | number | null | undefined>): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join("\u001f"))
    .digest("hex");
}

export function buildSecFilingUrl(
  cik: string,
  accessionNumber: string,
  primaryDocument: string | null,
): string {
  const numericCik = String(Number.parseInt(normalizeCik(cik), 10));
  const accession = accessionNumber.replace(/-/g, "");
  const document = primaryDocument?.replace(/^\/+/, "").trim();
  const base = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${accession}`;
  return document ? `${base}/${encodeURIComponent(document)}` : `${base}/`;
}

export function normalizeSubmissions(
  payload: SecSubmissionsPayload,
): NormalizedSecFiling[] {
  const recent = payload.filings.recent;
  const expected = recent.accessionNumber.length;
  const parallel = [
    recent.filingDate,
    recent.reportDate,
    recent.acceptanceDateTime,
    recent.form,
    recent.primaryDocument,
  ];
  if (parallel.some((values) => values.length !== expected)) {
    throw new Error("SEC submissions recent filing arrays have mismatched lengths");
  }

  const cik = normalizeCik(payload.cik);
  const filings: NormalizedSecFiling[] = [];
  for (let index = 0; index < expected; index += 1) {
    const accessionNumber = recent.accessionNumber[index]?.trim();
    const form = recent.form[index]?.trim().toUpperCase();
    const filedAt = cleanDate(recent.filingDate[index]);
    if (!accessionNumber || !form || !filedAt || !SUPPORTED_FORMS.has(form)) continue;

    const primaryDocument = recent.primaryDocument[index]?.trim() || null;
    filings.push({
      cik,
      accessionNumber,
      form,
      filedAt,
      reportDate: cleanDate(recent.reportDate[index]),
      acceptedAt: cleanDateTime(recent.acceptanceDateTime[index]),
      primaryDocument,
      sourceUrl: buildSecFilingUrl(cik, accessionNumber, primaryDocument),
    });
  }
  return filings;
}

function normalizeFactValue(value: SecFactUnitPayload["val"]): string | null {
  const candidate = typeof value === "number" ? String(value) : value.trim();
  if (!candidate) return null;
  const numeric = Number(candidate);
  if (!Number.isFinite(numeric)) return null;
  return candidate;
}

function normalizeFactRecord(
  cik: string,
  taxonomy: string,
  concept: string,
  label: string | undefined,
  description: string | undefined,
  unit: string,
  item: SecFactUnitPayload,
): NormalizedSecFact | null {
  const endDate = cleanDate(item.end);
  const value = normalizeFactValue(item.val);
  const form = item.form.trim().toUpperCase();
  const accessionNumber = item.accn.trim();
  if (!endDate || !value || !accessionNumber || !SUPPORTED_FORMS.has(form)) return null;

  const startDate = cleanDate(item.start);
  const filedAt = cleanDate(item.filed);
  const frame = item.frame?.trim() || null;
  return {
    factKey: stableKey([
      cik,
      taxonomy,
      concept,
      unit,
      startDate,
      endDate,
      accessionNumber,
      form,
      frame,
    ]),
    cik,
    taxonomy,
    concept,
    label: label?.trim() || null,
    description: description?.trim() || null,
    unit,
    value,
    startDate,
    endDate,
    filedAt,
    accessionNumber,
    form,
    frame,
    fiscalYear: item.fy ?? null,
    fiscalPeriod: item.fp?.trim() || null,
  };
}

export function normalizeCompanyFacts(payload: SecCompanyFactsPayload): {
  facts: NormalizedSecFact[];
  metrics: NormalizedSecMetric[];
} {
  const cik = normalizeCik(payload.cik);
  const factMap = new Map<string, NormalizedSecFact>();
  const metricMap = new Map<string, NormalizedSecMetric>();

  for (const definition of SEC_METRIC_DEFINITIONS) {
    const taxonomyFacts = payload.facts[definition.taxonomy];
    if (!taxonomyFacts) continue;

    const concept = definition.concepts.find((candidate) => taxonomyFacts[candidate]);
    if (!concept) continue;
    const conceptPayload = taxonomyFacts[concept];

    for (const preferredUnit of definition.preferredUnits) {
      const unitItems = conceptPayload.units[preferredUnit];
      if (!unitItems) continue;

      for (const item of unitItems) {
        const fact = normalizeFactRecord(
          cik,
          definition.taxonomy,
          concept,
          conceptPayload.label,
          conceptPayload.description,
          preferredUnit,
          item,
        );
        if (!fact) continue;
        factMap.set(fact.factKey, fact);

        const metricKey = stableKey([
          cik,
          definition.metric,
          fact.unit,
          fact.startDate,
          fact.endDate,
          fact.accessionNumber,
          fact.form,
          fact.frame,
        ]);
        metricMap.set(metricKey, {
          metricKey,
          metric: definition.metric,
          value: fact.value,
          unit: fact.unit,
          startDate: fact.startDate,
          endDate: fact.endDate,
          filedAt: fact.filedAt,
          accessionNumber: fact.accessionNumber,
          form: fact.form,
          taxonomy: fact.taxonomy,
          concept: fact.concept,
          frame: fact.frame,
          fiscalYear: fact.fiscalYear,
          fiscalPeriod: fact.fiscalPeriod,
        });
      }
      if (unitItems.length > 0) break;
    }
  }

  return {
    facts: [...factMap.values()],
    metrics: [...metricMap.values()],
  };
}
