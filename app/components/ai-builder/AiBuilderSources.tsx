"use client";

import { useMemo, useState } from "react";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

const INITIAL_PAGE_ROWS = 6;
const PAGE_ROW_INCREMENT = 6;
const INITIAL_WARNING_ROWS = 4;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const host = (value: string | null | undefined) => {
  if (!value) return "Not available";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
};

const path = (value: string | null | undefined) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return value;
  }
};

const humanize = (value: string | null | undefined) =>
  String(value ?? "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AiBuilderSources() {
  const { websiteKnowledge } = useAiBuilderWorkspace();
  const [visiblePages, setVisiblePages] = useState(INITIAL_PAGE_ROWS);
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  const pages = websiteKnowledge?.pages ?? [];
  const warnings = websiteKnowledge?.warnings ?? [];
  const documents = websiteKnowledge?.source_documents ?? [];
  const blocks = websiteKnowledge?.source_blocks ?? [];

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const retainedDocuments = documents.filter((document) => document.status === "retained").length;
  const skippedDocuments = documents.filter((document) => document.status === "skipped").length;
  const failedDocuments = documents.filter((document) => document.status === "failed").length;
  const visiblePageRows = pages.slice(0, visiblePages);
  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, INITIAL_WARNING_ROWS);
  const hasMorePages = visiblePageRows.length < pages.length;
  const hasMoreWarnings = visibleWarnings.length < warnings.length;

  return (
    <div className="min-w-0 space-y-5 pb-2">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Connected website" value={host(websiteKnowledge?.resolved_url)} detail={websiteKnowledge?.resolved_url ? "Active website source" : "No website connected"} />
        <Summary label="Pages imported" value={String(pages.length)} detail={`${retainedDocuments} retained source record${retainedDocuments === 1 ? "" : "s"}`} />
        <Summary label="Source blocks" value={String(blocks.length)} detail="Evidence-ready content blocks" />
        <Summary label="Last import" value={formatDate(websiteKnowledge?.imported_at)} detail={`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`} compact />
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505]">
        <div className="border-b border-white/[.12] px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Website sources</p>
          <p className="mt-2 text-sm text-slate-400">Pages currently connected to this project</p>
        </div>

        {pages.length ? (
          <>
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2.4fr)_minmax(110px,.7fr)_minmax(110px,.7fr)] border-b border-white/[.12] bg-black/60 px-5 py-3 text-center text-[.68rem] font-semibold uppercase tracking-[.1em] text-slate-500">
                  <span>Page</span>
                  <span>Source URL</span>
                  <span>Type</span>
                  <span>Status</span>
                </div>

                <div className="divide-y divide-white/[.12]">
                  {visiblePageRows.map((page, index) => {
                    const document = page.sourceDocumentId ? documentById.get(page.sourceDocumentId) : undefined;
                    const status = document?.status ?? "retained";
                    return (
                      <div
                        key={`${page.url}-${index}`}
                        className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2.4fr)_minmax(110px,.7fr)_minmax(110px,.7fr)] items-center px-5 py-4"
                      >
                        <div className="min-w-0 pr-4 text-left">
                          <p className="truncate text-sm font-semibold text-white" title={page.title || "Untitled page"}>
                            {page.title || "Untitled page"}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500" title={path(page.url)}>
                            {path(page.url)}
                          </p>
                        </div>

                        <div className="min-w-0 px-4 text-left">
                          <p className="truncate text-sm text-slate-300" title={page.url}>
                            {page.url}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {document ? `Fetched ${formatDate(document.fetchedAt)}` : host(page.url)}
                          </p>
                        </div>

                        <div className="text-center">
                          <span className="inline-flex rounded-lg border border-white/[.12] bg-black px-2.5 py-1 text-xs font-semibold text-slate-300">
                            {humanize(document?.sourceType ?? page.pageType)}
                          </span>
                        </div>

                        <div className="text-center">
                          <span className={`inline-flex rounded-lg border border-white/[.12] bg-black px-2.5 py-1 text-xs font-bold capitalize ${status === "failed" ? "text-red-300" : status === "skipped" ? "text-amber-300" : "text-emerald-300"}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {hasMorePages ? (
              <div className="border-t border-white/[.12] px-5 py-4 text-center">
                <button
                  type="button"
                  onClick={() => setVisiblePages((current) => Math.min(current + PAGE_ROW_INCREMENT, pages.length))}
                  className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25"
                >
                  Show more
                </button>
                <p className="mt-2 text-xs text-slate-600">
                  Showing {visiblePageRows.length} of {pages.length} pages
                </p>
              </div>
            ) : pages.length > INITIAL_PAGE_ROWS ? (
              <div className="border-t border-white/[.12] px-5 py-4 text-center">
                <button
                  type="button"
                  onClick={() => setVisiblePages(INITIAL_PAGE_ROWS)}
                  className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25"
                >
                  Show less
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <Empty text="No website source pages are connected to this project." />
        )}
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Source health</p>
          <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-white/[.12]">
            <Metric label="Requested URL" value={host(websiteKnowledge?.requested_url)} />
            <Metric label="Resolved URL" value={host(websiteKnowledge?.resolved_url)} />
            <Metric label="Retained" value={String(retainedDocuments)} />
            <Metric label="Skipped" value={String(skippedDocuments)} />
            <Metric label="Failed" value={String(failedDocuments)} />
            <Metric label="Crawl attempt" value={websiteKnowledge?.current_crawl_attempt_id ? "Recorded" : "Not available"} />
          </dl>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Import warnings</p>
          {warnings.length ? (
            <>
              <div className="mt-4 overflow-hidden rounded-lg border border-white/[.12]">
                <div className="divide-y divide-white/[.12]">
                  {visibleWarnings.map((warning, index) => (
                    <div key={`${warning}-${index}`} className="grid grid-cols-[2.25rem_1fr] items-start px-4 py-3.5">
                      <span className="text-center text-xs font-bold text-amber-300">{index + 1}</span>
                      <p className="min-w-0 break-words text-sm leading-6 text-slate-300">{warning}</p>
                    </div>
                  ))}
                </div>
              </div>
              {hasMoreWarnings ? (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllWarnings(true)}
                    className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25"
                  >
                    Show more
                  </button>
                </div>
              ) : warnings.length > INITIAL_WARNING_ROWS ? (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAllWarnings(false)}
                    className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25"
                  >
                    Show less
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <Empty text="No import warnings were recorded for this website source." compact />
          )}
        </section>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <article className="min-w-0 rounded-[18px] border border-white/[.12] bg-[#070707] p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{label}</p>
      <p className={`mt-2 truncate font-semibold text-white ${compact ? "text-base" : "text-2xl"}`} title={value}>
        {value}
      </p>
      <p className="mt-2 truncate text-xs leading-5 text-slate-500" title={detail}>
        {detail}
      </p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-r border-white/[.12] bg-black/40 px-3.5 py-3 text-center even:border-r-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-white" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-4 min-h-[170px]" : "min-h-[280px]"} flex items-center justify-center px-5 text-center text-sm leading-6 text-slate-600`}>
      {text}
    </div>
  );
}
