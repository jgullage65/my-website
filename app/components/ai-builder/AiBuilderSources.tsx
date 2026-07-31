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

export default function AiBuilderSources() {
  const { websiteKnowledge } = useAiBuilderWorkspace();

  const stats = useMemo(
    () => ({
      pages: websiteKnowledge?.pages.length ?? 0,
      documents: websiteKnowledge?.source_documents?.length ?? 0,
      blocks: websiteKnowledge?.source_blocks?.length ?? 0,
      facts: websiteKnowledge?.knowledge.facts.length ?? 0,
    }),
    [websiteKnowledge],
  );

  if (!websiteKnowledge) {
    return (
      <section className="flex min-h-[52vh] items-center justify-center rounded-[22px] border border-white/[0.08] bg-[#050505] px-6 py-12 text-center">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Sources</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">No connected source material yet</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This project does not currently have imported website material. Add or refresh source material from the Builder to populate this workspace.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-white/[0.08] bg-[#050505] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Primary source</p>
            <h2 className="mt-3 truncate text-2xl font-semibold text-white">
              {websiteKnowledge.resolved_url || websiteKnowledge.requested_url || "Imported website"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
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

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[20px] border border-white/[0.07] bg-[#070707] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Imported pages</p>
          <div className="mt-4 space-y-3">
            {websiteKnowledge.pages.length ? (
              websiteKnowledge.pages.map((page, index) => (
                <article key={`${page.url}-${index}`} className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{page.title || page.url}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{page.url}</p>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-5 text-center text-sm text-slate-500">
                No page records are available for this import.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-white/[0.07] bg-[#070707] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Import health</p>
          <div className="mt-4 space-y-3">
            <StatusRow label="Requested URL" value={websiteKnowledge.requested_url || "Not recorded"} />
            <StatusRow label="Resolved URL" value={websiteKnowledge.resolved_url || "Not recorded"} />
            <StatusRow label="Import version" value={`v${websiteKnowledge.document_version}`} />
            <StatusRow label="Warnings" value={String(websiteKnowledge.warnings.length)} />
          </div>

          {websiteKnowledge.warnings.length ? (
            <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Warnings</p>
              <div className="mt-3 space-y-2">
                {websiteKnowledge.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`} className="text-sm leading-6 text-slate-300">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-4 text-sm text-slate-500">
              No import warnings were recorded.
            </p>
          )}
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[62%] truncate text-right text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
