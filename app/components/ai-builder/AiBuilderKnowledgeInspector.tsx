"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

type ItemKind = "context_entry" | "faq";

type ProvenanceResponse = {
  ok: true;
  provenance: {
    item: {
      itemKind: ItemKind;
      itemId: string;
      classification: "manual" | "website" | "ai_generated" | "user_corrected";
      originalClassification: "manual" | "website" | "ai_generated" | "user_corrected" | null;
      predecessorClassification: "manual" | "website" | "ai_generated" | "user_corrected" | null;
      confidence: "high" | "medium" | "low";
      confidenceScore: number;
      availability: "exact" | "partial" | "classification_only";
      relatedEntryIds: string[];
      evidence: Array<{
        url: string | null;
        excerpt: string;
        sourceDocumentId: string | null;
        sourceBlockId: string | null;
        crawlAttemptId: string | null;
      }>;
    };
    canonical: {
      reviewHistory: Array<{
        reviewIdentity: string;
        action: string;
        reviewedAt: string;
      }>;
      currentTrustedRevision: number | null;
      currentTrustedLifecycle: "active" | "archived" | "rejected" | null;
    };
  };
};

type SelectedItem = {
  kind: ItemKind;
  id: string;
  label: string;
};

function sourceLabel(value: ProvenanceResponse["provenance"]["item"]["classification"]) {
  if (value === "website") return "Website";
  if (value === "manual") return "Manual";
  if (value === "user_corrected") return "User corrected";
  return "Generated";
}

function availabilityLabel(value: ProvenanceResponse["provenance"]["item"]["availability"]) {
  if (value === "exact") return "Exact source details";
  if (value === "partial") return "URL and excerpt available";
  return "Source type only";
}

export default function AiBuilderKnowledgeInspector() {
  const { projectId, session } = useAiBuilderWorkspace();
  const items = useMemo<SelectedItem[]>(
    () => [
      ...session.contextEntries.map((entry) => ({ kind: "context_entry" as const, id: entry.id, label: entry.title })),
      ...session.faqEntries.map((entry) => ({ kind: "faq" as const, id: entry.id, label: entry.question })),
    ],
    [session.contextEntries, session.faqEntries],
  );
  const [selectedKey, setSelectedKey] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProvenanceResponse["provenance"] | null>(null);

  useEffect(() => {
    if (!selectedKey && items[0]) setSelectedKey(`${items[0].kind}:${items[0].id}`);
  }, [items, selectedKey]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const selected = items.find((item) => `${item.kind}:${item.id}` === selectedKey) ?? null;

  const inspect = async () => {
    if (!selected) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const response = await fetch(
        `/api/ai-builder/projects/${encodeURIComponent(projectId)}/knowledge/${selected.kind}/${encodeURIComponent(selected.id)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error?.message ?? "Source details could not be loaded.");
      }
      setDetail((payload as ProvenanceResponse).provenance);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Source details could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) return null;

  return (
    <>
      <section className="mb-5 rounded-[14px] border border-white/[0.055] bg-[#080808]/90 px-4 py-4 shadow-[0_14px_36px_rgba(0,0,0,0.2)] sm:px-5">
        <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Source details</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#030303] px-3 text-sm text-slate-200 outline-none transition focus:border-amber-300/35"
            aria-label="Choose knowledge item"
          >
            {items.map((item) => (
              <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                {item.kind === "faq" ? "Q&A: " : "Knowledge: "}{item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void inspect()}
            className="cta-raised min-h-11 rounded-lg border border-amber-300/20 bg-black px-5 py-2.5 text-xs font-bold text-white transition hover:border-amber-300/40 hover:bg-[#0a0a0a] sm:min-w-[150px]"
          >
            View source
          </button>
        </div>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-label="Knowledge source details" className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-white/[0.1] bg-[#080808] shadow-[0_28px_90px_rgba(0,0,0,0.65)]">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#080808]/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Source details</p>
                <h2 className="mt-1 truncate text-base font-semibold text-white">{selected?.label}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close source details" className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] text-2xl text-slate-400 transition hover:text-white">×</button>
            </header>

            <div className="space-y-5 p-5 sm:p-6">
              {loading ? <p className="py-12 text-center text-sm text-slate-400">Loading source details...</p> : null}
              {error ? <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

              {detail ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Meta label="Source" value={sourceLabel(detail.item.classification)} />
                    <Meta label="Confidence" value={`${detail.item.confidence} · ${Math.round(detail.item.confidenceScore * 100)}%`} />
                    <Meta label="Coverage" value={availabilityLabel(detail.item.availability)} />
                    <Meta label="Evidence" value={String(detail.item.evidence.length)} />
                  </div>

                  {detail.item.originalClassification ? (
                    <p className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 text-sm text-slate-300">
                      Original source: <span className="font-semibold text-white">{sourceLabel(detail.item.originalClassification)}</span>
                    </p>
                  ) : null}

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supporting evidence</h3>
                    <div className="mt-3 space-y-3">
                      {detail.item.evidence.length ? detail.item.evidence.map((evidence, index) => (
                        <article key={`${evidence.sourceBlockId ?? evidence.url ?? "evidence"}:${index}`} className="rounded-xl border border-white/[0.065] bg-black/30 p-4">
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{evidence.excerpt}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] text-slate-500">
                            {evidence.url ? <a href={evidence.url} target="_blank" rel="noreferrer" className="text-amber-300 transition hover:text-amber-200">Open source page</a> : null}
                            {evidence.sourceBlockId ? <span>Exact block</span> : null}
                            {evidence.crawlAttemptId ? <span>Crawl linked</span> : null}
                          </div>
                        </article>
                      )) : <p className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-5 text-center text-sm text-slate-500">No supporting excerpt is available for this older item.</p>}
                    </div>
                  </section>

                  {detail.item.relatedEntryIds.length ? (
                    <Meta label="Related knowledge items" value={String(detail.item.relatedEntryIds.length)} />
                  ) : null}

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Review history</h3>
                    <div className="mt-3 space-y-2">
                      {detail.canonical.reviewHistory.length ? detail.canonical.reviewHistory.map((review) => (
                        <div key={review.reviewIdentity} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
                          <span className="text-sm font-semibold capitalize text-slate-200">{review.action.replace("_", " ")}</span>
                          <span className="text-xs text-slate-500">{new Date(review.reviewedAt).toLocaleString()}</span>
                        </div>
                      )) : <p className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-4 text-sm text-slate-500">No canonical review history is available yet.</p>}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-4 text-center">
      <p className="text-sm font-semibold text-white">{value}</p>
      <p className="mt-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  );
}
