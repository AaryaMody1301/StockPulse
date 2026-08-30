"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Download,
  FileClock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  EMPTY_THESIS_DRAFT,
  evidenceLinkSchema,
  type EvidenceLink,
  type EvidenceRelationship,
  type ThesisDraft,
  type ThesisRecord,
} from "@/lib/thesis/schema";
import {
  deleteThesis,
  exportTheses,
  importTheses,
  listTheses,
  requestPersistentResearchStorage,
  saveThesis,
} from "@/lib/thesis/storage";

const RELATIONSHIPS: EvidenceRelationship[] = [
  "supports",
  "contradicts",
  "qualifies",
  "unresolved",
];

function linesToText(values: string[]): string {
  return values.join("\n");
}

function textToLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function draftFromRecord(record: ThesisRecord): ThesisDraft {
  return {
    symbol: record.symbol,
    title: record.title,
    summary: record.summary,
    assumptions: record.assumptions,
    risks: record.risks,
    catalysts: record.catalysts,
    invalidationCriteria: record.invalidationCriteria,
    evidenceLinks: record.evidenceLinks,
  };
}

function newEvidence(): EvidenceLink {
  return {
    id: `evidence-${crypto.randomUUID()}`,
    label: "",
    url: "",
    relationship: "unresolved",
    sourceType: "other",
    notes: "",
  };
}

function ListField({
  label,
  description,
  values,
  onChange,
}: {
  label: string;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-muted-foreground">{description}</span>
      <textarea
        value={linesToText(values)}
        onChange={(event) => onChange(textToLines(event.target.value))}
        rows={5}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        placeholder="One item per line"
      />
    </label>
  );
}

export function ThesisWorkspace() {
  const [records, setRecords] = useState<ThesisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ThesisDraft>(EMPTY_THESIS_DRAFT);
  const [revisionNote, setRevisionNote] = useState("Updated thesis");
  const [status, setStatus] = useState("Loading local research…");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) || null,
    [records, selectedId],
  );

  async function refresh(preferredId?: string | null) {
    const next = await listTheses();
    setRecords(next);
    const nextId = preferredId ?? selectedId;
    if (nextId && next.some((record) => record.id === nextId)) {
      setSelectedId(nextId);
      return;
    }
    if (!selectedId && next.length > 0) {
      setSelectedId(next[0].id);
      setDraft(draftFromRecord(next[0]));
    }
  }

  useEffect(() => {
    void listTheses()
      .then((next) => {
        setRecords(next);
        if (next.length > 0) {
          setSelectedId(next[0].id);
          setDraft(draftFromRecord(next[0]));
        }
        setStatus(next.length > 0 ? "Research loaded from this browser." : "No saved theses yet.");
      })
      .catch(() => setStatus("Local research storage could not be opened."));
  }, []);

  function choose(record: ThesisRecord) {
    setSelectedId(record.id);
    setDraft(draftFromRecord(record));
    setRevisionNote("Updated thesis");
    setStatus(`Editing ${record.symbol}.`);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(EMPTY_THESIS_DRAFT);
    setRevisionNote("Initial thesis");
    setStatus("Creating a new thesis.");
  }

  async function handleSave() {
    setBusy(true);
    try {
      const saved = await saveThesis(draft, selected, revisionNote);
      setDraft(draftFromRecord(saved));
      setSelectedId(saved.id);
      await refresh(saved.id);
      setRevisionNote("Updated thesis");
      setStatus(`Saved ${saved.symbol}. Revision history is preserved locally.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save thesis.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteThesis(selected.id);
      const next = await listTheses();
      setRecords(next);
      if (next.length > 0) {
        setSelectedId(next[0].id);
        setDraft(draftFromRecord(next[0]));
      } else {
        setSelectedId(null);
        setDraft(EMPTY_THESIS_DRAFT);
      }
      setStatus(`Deleted ${selected.symbol} from this browser.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      const bundle = await exportTheses();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `stockpulse-theses-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${bundle.records.length} thesis record(s).`);
    } catch {
      setStatus("Unable to export local research.");
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const count = await importTheses(parsed);
      await refresh();
      setStatus(`Imported ${count} validated thesis record(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? `Import rejected: ${error.message}` : "Import rejected.");
    } finally {
      if (importRef.current) importRef.current.value = "";
      setBusy(false);
    }
  }

  async function protectStorage() {
    const result = await requestPersistentResearchStorage();
    if (result === true) setStatus("Browser persistent storage is enabled for this origin.");
    else if (result === false) setStatus("Persistent storage was not granted. Keep regular exports as backups.");
    else setStatus("This browser does not expose persistent-storage controls.");
  }

  function updateEvidence(index: number, patch: Partial<EvidenceLink>) {
    setDraft((current) => ({
      ...current,
      evidenceLinks: current.evidenceLinks.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addEvidence() {
    setDraft((current) => ({
      ...current,
      evidenceLinks: [...current.evidenceLinks, newEvidence()].slice(0, 100),
    }));
  }

  function removeEvidence(index: number) {
    setDraft((current) => ({
      ...current,
      evidenceLinks: current.evidenceLinks.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  const validEvidenceCount = draft.evidenceLinks.filter((item) => evidenceLinkSchema.safeParse(item).success).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Research workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Investment theses</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Record why you follow a company, what could invalidate the thesis, and which evidence supports or challenges it. Data stays in this browser unless you export it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={protectStorage}>
            <ShieldCheck className="h-4 w-4" />
            Protect storage
          </Button>
          <Button variant="outline" onClick={() => void handleExport()}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" onClick={() => importRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button onClick={startNew}>
            <Plus className="h-4 w-4" />
            New thesis
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {status}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4" />
              Saved research
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create your first thesis to begin a review history.</p>
            ) : (
              records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => choose(record)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                    record.id === selectedId ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{record.symbol}</span>
                    <span className="text-[11px] text-muted-foreground">{record.revisions.length} revisions</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{record.title}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thesis statement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ticker</span>
                  <Input
                    value={draft.symbol}
                    onChange={(event) => setDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                    placeholder="AAPL"
                    maxLength={10}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Title</span>
                  <Input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Why this company deserves continued attention"
                    maxLength={200}
                  />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Core thesis</span>
                <textarea
                  value={draft.summary}
                  onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                  rows={7}
                  maxLength={10000}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  placeholder="State the thesis in falsifiable terms. Separate facts from your interpretation."
                />
              </label>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">What must remain true?</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <ListField
                  label="Assumptions"
                  description="Claims or conditions the thesis depends on."
                  values={draft.assumptions}
                  onChange={(values) => setDraft((current) => ({ ...current, assumptions: values }))}
                />
                <ListField
                  label="Catalysts"
                  description="Events that could strengthen or accelerate the thesis."
                  values={draft.catalysts}
                  onChange={(values) => setDraft((current) => ({ ...current, catalysts: values }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">What could break it?</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <ListField
                  label="Risks"
                  description="Known downside cases or uncertainties."
                  values={draft.risks}
                  onChange={(values) => setDraft((current) => ({ ...current, risks: values }))}
                />
                <ListField
                  label="Invalidation criteria"
                  description="Concrete observations that should make you revisit or abandon the thesis."
                  values={draft.invalidationCriteria}
                  onChange={(values) => setDraft((current) => ({ ...current, invalidationCriteria: values }))}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Evidence links</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {validEvidenceCount}/{draft.evidenceLinks.length} links currently validate.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addEvidence}>
                  <Plus className="h-4 w-4" />
                  Add evidence
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.evidenceLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add primary-source filings or other evidence and classify the relationship to your thesis.
                </p>
              ) : (
                draft.evidenceLinks.map((item, index) => (
                  <div key={item.id} className="space-y-3 rounded-xl border p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={item.label} onChange={(event) => updateEvidence(index, { label: event.target.value })} placeholder="Evidence label" />
                      <Input value={item.url} onChange={(event) => updateEvidence(index, { url: event.target.value })} placeholder="https://www.sec.gov/..." />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        Relationship
                        <select
                          value={item.relationship}
                          onChange={(event) => updateEvidence(index, { relationship: event.target.value as EvidenceRelationship })}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        >
                          {RELATIONSHIPS.map((relationship) => (
                            <option key={relationship} value={relationship}>{relationship}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        Source type
                        <select
                          value={item.sourceType}
                          onChange={(event) => updateEvidence(index, { sourceType: event.target.value as EvidenceLink["sourceType"] })}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        >
                          <option value="sec">SEC</option>
                          <option value="company">Company</option>
                          <option value="market">Market data</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateEvidence(index, { notes: event.target.value })}
                      rows={2}
                      maxLength={2000}
                      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Why this evidence matters"
                    />
                    <div className="flex items-center justify-between">
                      {item.url.startsWith("http") ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          Open source
                        </a>
                      ) : <span />}
                      <Button variant="ghost" size="sm" onClick={() => removeEvidence(index)}>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileClock className="h-4 w-4" />Revision history</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-medium">Save note</span>
                <Input value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} maxLength={500} placeholder="What changed in your reasoning?" />
              </label>
              {selected?.revisions.length ? (
                <div className="space-y-2">
                  {selected.revisions.slice(0, 10).map((revision) => (
                    <div key={revision.id} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{revision.note}</span>
                        <span className="text-xs text-muted-foreground">{new Date(revision.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{revision.snapshot.summary || "No thesis summary in this revision."}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Earlier snapshots appear here after the thesis changes and is saved again.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              Browser research is not account-synced. Keep exports for important work and avoid storing credentials or secrets.
              {draft.symbol && <Link href={`/stocks/${draft.symbol}`} className="ml-2 text-primary hover:underline">Open {draft.symbol}</Link>}
            </div>
            <div className="flex gap-2">
              {selected && (
                <Button variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button onClick={() => void handleSave()} disabled={busy}>
                <Save className="h-4 w-4" />
                Save thesis
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
