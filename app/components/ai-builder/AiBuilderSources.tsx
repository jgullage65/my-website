"use client";

import { useMemo } from "react";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

function formatDate(value?: string | null) {
  if (!value) return "Not imported yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Imported"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function host(value?: string | null) {
  if (!value) return "Website";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function statusFromAttempt(value: unknown) {
  return String(value ?? "unknown").replace(/_/g, " ");
}

function numericValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function attemptTimestamp(item: Record<string, unknown>) {
  const value = item.completed_at ?? item.started_at;
  if (!value) return 0;
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function AiBuilderSources() {
  const { websiteKnowledge, session, diagnostics, setActiveTab } = useAiBuilderWorkspace();

  const stats = useMemo(
    () => ({
      pages: websiteKnowledge?.pages.length ?? 0,
      documents: websiteKnowledge?.source_documents?.length ?? 0,
      blocks: websiteKnowledge?.source_blocks?.length ?? 0,
      facts: websiteKnowledge?.knowledge.facts.length ?? 0,
    }),
    [websiteKnowledge],
  );

  const latestAttempt = useMemo(
    () => [...(diagnostics?.crawls ?? [])].sort((left, right) => attemptTimestamp(right) - attemptTimestamp(left))[0] ?? null,
    [diagnostics?.crawls],
  );
  const websiteKnowledgeCount = session.contextEntries.filter(
    (item) => item.source.sourceType === "website",
  ).length;
  const manualKnowledgeCount = session.contextEntries.filter(
    (item) =>
      (item.source.sourceType === "manual_intake" || item.source.sourceType === "user_edit") &&
      (item.status === "approved" || item.status === "corrected"),
  ).length;
  const unresolvedQuestionItems = websiteKnowledge?.knowledge.unresolvedQuestions ?? [];
  const unresolvedQuestions = unresolvedQuestionItems.length;
  const processedPages = numericValue(latestAttempt?.pages_processed, stats.pages);
  const failedPages = numericValue(latestAttempt?.pages_failed);
  const skippedPages = numericValue(latestAttempt?.pages_skipped);
  const attemptStatus = statusFromAttempt(latestAttempt?.status);
  const normalizedAttemptStatus = String(latestAttempt?.status ?? "").toLowerCase();
  const latestAttemptCompleted = ["completed", "success", "succeeded"].includes(normalizedAttemptStatus);
  const latestAttemptFailed = ["failed", "error", "cancelled", "canceled"].includes(normalizedAttemptStatus);
  const warningCount = websiteKnowledge?.warnings.length ?? 0;
  const sourceHealthy = Boolean(websiteKnowledge) && latestAttemptCompleted && failedPages === 0 && warningCount === 0;
  const sourceNeedsReview = Boolean(websiteKnowledge) && (latestAttemptFailed || failedPages > 0 || warningCount > 0);

  if (!websiteKnowledge) {
    return (
      <section className="flex min-h-[52vh] items-center justify-center rounded-[22px] border border-white/[0.08] bg-[#050505] px-6 py-12 text-center">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Sources</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">No connected source material yet</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This project does not currently have imported website material. Add source material from the Builder to populate this workspace.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="cta-raised mt-5 rounded-lg border border-amber-300/20 bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:border-amber-300/40"
          >
            Open project overview
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-white/[0.08] bg-[#050505] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Primary source</p>
              <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] ${sourceHealthy ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300" : sourceNeedsReview ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-300" : "border-white/[0.08] bg-white/[0.03] text-slate-400"}`}>
                {sourceHealthy ? "Imported cleanly" : sourceNeedsReview ? "Needs review" : "Import recorded"}
              </span>
            </div>
            <h2 className="mt-3 truncate text-2xl font-semibold text-white">
              {host(websiteKnowledge.resolved_url || websiteKnowledge.requested_url)}
            </h2>
            <p className="mt-2 truncate text-sm text-slate-400">
              {websiteKnowledge.resolved_url || websiteKnowledge.requested_url || "Imported website"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last imported {formatDate(websiteKnowledge.imported_at)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[440px]">
            <Stat label="Pages" value={stats.pages} />
            <Stat label="Documents" value={stats.documents} />
            <Stat label="Blocks" value={stats.blocks} />
            <Stat label="Facts" value={stats.facts} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <SummaryCard label="Website knowledge" value={websiteKnowledgeCount} detail="Persisted knowledge items sourced from the imported website." />
        <SummaryCard label="Manual knowledge" value={manualKnowledgeCount} detail="Approved or corrected knowledge contributed directly by the user." />
        <SummaryCard label="Open questions" value={unresolvedQuestions} detail="Unresolved questions still detected in the imported material." />
      </section>

      {unresolvedQuestionItems.length ? (
        <section className="rounded-[20px] border border-amber-300/15 bg-amber-300/[0.035] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Source gaps</p>
              <h3 className="mt-2 text-lg font-semibold text-white">Questions the website did not answer</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Add or correct this information in Business Knowledge so the assistant does not have to guess.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("knowledge")}
              className="cta-raised shrink-0 rounded-lg border border-amber-300/20 bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:border-amber-300/40"
            >
              Open Business Knowledge
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {unresolvedQuestionItems.map((question, index) => (
              <p key={`${String(question)}-${index}`} className="rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3 text-sm leading-6 text-slate-300">
                {String(question)}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[20px] border border-white/[0.07] bg-[#070707] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Imported pages</p>
              <p className="mt-1 text-xs text-slate-600">Inspect the exact pages saved for the latest website import.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{stats.pages} total</span>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {websiteKnowledge.pages.length ? (
              websiteKnowledge.pages.map((page, index) => {
                const pageUrl = safeExternalUrl(page.url);
                return (
                  <article key={`${page.url}-${index}`} className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{page.title || page.url}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{page.url}</p>
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        {pageUrl ? (
                          <a
                            href={pageUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="rounded-lg border border-amber-300/15 bg-black px-2.5 py-1.5 text-[0.65rem] font-bold text-amber-300 transition hover:border-amber-300/35 hover:text-amber-200"
                            aria-label={`Open ${page.title || page.url} in a new tab`}
                          >
                            Open
                          </a>
                        ) : null}
                        <span className="rounded-full border border-white/[0.08] bg-black px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                          Page {index + 1}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-5 text-center text-sm text-slate-500">
                No page records are available for this import.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[20px] border border-white/[0.07] bg-[#070707] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Import health</p>
            <div className="mt-4 space-y-3">
              <StatusRow label="Latest attempt" value={attemptStatus} />
              <StatusRow label="Requested URL" value={websiteKnowledge.requested_url || "Not recorded"} />
              <StatusRow label="Resolved URL" value={websiteKnowledge.resolved_url || "Not recorded"} />
              <StatusRow label="Import version" value={`v${websiteKnowledge.document_version}`} />
              <StatusRow label="Warnings" value={String(warningCount)} />
              <StatusRow label="Processed pages" value={String(processedPages)} />
              <StatusRow label="Skipped pages" value={String(skippedPages)} />
              <StatusRow label="Failed pages" value={String(failedPages)} />
            </div>
          </div>

          <div className="rounded-[20px] border border-white/[0.07] bg-[#070707] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Warnings</p>
              <button
                type="button"
                onClick={() => setActiveTab("insights")}
                className="text-xs font-semibold text-amber-300 transition hover:text-amber-200"
              >
                View diagnostics
              </button>
            </div>

            {websiteKnowledge.warnings.length ? (
              <div className="mt-4 space-y-2">
                {websiteKnowledge.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`} className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                    {warning}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-4 text-sm text-slate-500">
                No import warnings were recorded.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-4 text-center">
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-[18px] border border-white/[0.07] bg-[#070707] p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[62%] truncate text-right text-sm font-semibold capitalize text-white" title={value}>{value}</span>
    </div>
  );
}
