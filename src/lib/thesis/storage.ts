"use client";

import { normalizeStockSymbol } from "@/lib/symbols";
import {
  thesisExportBundleSchema,
  thesisRecordSchema,
  thesisSnapshot,
  type ThesisDraft,
  type ThesisExportBundle,
  type ThesisRecord,
} from "./schema";

const DB_NAME = "stockpulse-research";
const DB_VERSION = 1;
const THESIS_STORE = "theses";
const MAX_REVISIONS = 50;
const MAX_REVIEWED_EVIDENCE = 250;

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("Unable to open research database"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(THESIS_STORE)) {
        const store = db.createObjectStore(THESIS_STORE, { keyPath: "id" });
        store.createIndex("symbol", "symbol", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const transaction = db.transaction(THESIS_STORE, mode);
    const store = transaction.objectStore(THESIS_STORE);
    const result = await action(store);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
    return result;
  } finally {
    db.close();
  }
}

export async function listTheses(): Promise<ThesisRecord[]> {
  const values = await withStore("readonly", (store) => requestResult(store.getAll()));
  return values
    .map((value) => thesisRecordSchema.safeParse(value))
    .filter((result) => result.success)
    .map((result) => result.data)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getThesis(recordId: string): Promise<ThesisRecord | null> {
  const value = await withStore("readonly", (store) => requestResult(store.get(recordId)));
  if (!value) return null;
  const parsed = thesisRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function saveThesis(
  draft: ThesisDraft,
  existing: ThesisRecord | null,
  revisionNote = "Updated thesis",
): Promise<ThesisRecord> {
  const normalizedSymbol = normalizeStockSymbol(draft.symbol);
  if (existing && normalizedSymbol !== existing.symbol) {
    throw new Error("A saved thesis ticker cannot be changed. Create a new thesis for another company.");
  }

  const snapshot = thesisSnapshot(draft);
  const now = new Date().toISOString();

  const revisions = existing ? [...existing.revisions] : [];
  if (existing) {
    const previousSnapshot = thesisSnapshot(existing);
    if (JSON.stringify(previousSnapshot) !== JSON.stringify(snapshot)) {
      revisions.unshift({
        id: id("revision"),
        createdAt: now,
        note: revisionNote.trim().slice(0, 500) || "Updated thesis",
        snapshot: previousSnapshot,
      });
    }
  }

  const record = thesisRecordSchema.parse({
    ...snapshot,
    id: existing?.id || id("thesis"),
    symbol: normalizedSymbol,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    revisions: revisions.slice(0, MAX_REVISIONS),
    lastReviewedAt: existing?.lastReviewedAt ?? null,
    reviewedEvidenceIds: existing?.reviewedEvidenceIds ?? [],
  });

  await withStore("readwrite", async (store) => {
    await requestResult(store.put(record));
  });
  return record;
}

export async function markThesisReviewed(
  recordId: string,
  evidenceIds: string[],
): Promise<ThesisRecord> {
  const existing = await getThesis(recordId);
  if (!existing) throw new Error("Thesis record was not found");

  const reviewedEvidenceIds = [...new Set(evidenceIds.map((value) => value.trim()).filter(Boolean))]
    .slice(0, MAX_REVIEWED_EVIDENCE);
  const now = new Date().toISOString();
  const record = thesisRecordSchema.parse({
    ...existing,
    updatedAt: now,
    lastReviewedAt: now,
    reviewedEvidenceIds,
  });

  await withStore("readwrite", async (store) => {
    await requestResult(store.put(record));
  });
  return record;
}

export async function deleteThesis(recordId: string): Promise<void> {
  await withStore("readwrite", async (store) => {
    await requestResult(store.delete(recordId));
  });
}

export async function exportTheses(): Promise<ThesisExportBundle> {
  return thesisExportBundleSchema.parse({
    format: "stockpulse-thesis-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: await listTheses(),
  });
}

export async function importTheses(input: unknown): Promise<number> {
  const bundle = thesisExportBundleSchema.parse(input);
  await withStore("readwrite", async (store) => {
    for (const record of bundle.records) {
      await requestResult(store.put(record));
    }
  });
  return bundle.records.length;
}

export async function requestPersistentResearchStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
