"use client";

import { useEffect, useMemo, useState } from "react";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

const INITIAL_PAGE_ROWS = 6;
const PAGE_ROW_INCREMENT = 6;
const INITIAL_WARNING_ROWS = 4;
const CRAWL_HISTORY_ROWS = 5;

type PageSort = "title" | "newest" | "type" | "status";

const formatDate = (value: unknown) => {
  if (!value) return "Not available";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const duration = (value: unknown) => {
  const milliseconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Not available";
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${Math.round(milliseconds / 1000)}s`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
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

const timestamp = (value: unknown) => {
  const parsed = value ? new Date(String(value)).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function AiBuilderSources() {
  const { websiteKnowledge, diagnostics, session, setActiveTab } = useAiBuilderWorkspace();
  const [visiblePages, setVisiblePages] = useState(INITIAL_PAGE_ROWS);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<PageSort>("title");
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  const pages = websiteKnowledge?.pages ?? [];
  const warnings = websiteKnowledge?.warnings ?? [];
  const documents = websiteKnowledge?.source_documents ?? [];
  const blocks = websiteKnowledge?.source_blocks ?? [];
  const crawls = useMemo(
    () => [...(diagnostics?.crawls ?? [])].sort((a, b) => timestamp(b.started_at) - timestamp(a.started_at)),
    [diagnostics?.crawls],
  );
  const latestCrawl = crawls[0];

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const knowledgeByUrl = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of session.contextEntries) {
      const url = entry.source.sourceUrl;
      if (entry.source.sourceType !== "website" || !url) continue;
      counts.set(url, (counts.get(url) ?? 0) + 1);
    }
    return counts;
  }, [session.contextEntries]);

  const sourceRows = useMemo(
    () =>
      pages.map((page, index) => {
        const document = page.sourceDocumentId ? documentById.get(page.sourceDocumentId) : undefined;
        return {
          page,
          document,
          index,
          status: document?.status ?? "retained",
          sourceType: document?.sourceType ?? page.pageType,
          knowledgeCount: knowledgeByUrl.get(page.url) ?? 0,
        };
      }),
    [documentById, knowledgeByUrl, pages],
  );

  const sourceTypes = useMemo(
    () => Array.from(new Set(sourceRows.map((row) => row.sourceType).filter(Boolean))).sort(),
    [sourceRows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sourceRows
      .filter((row) => {
        const matchesSearch =
          !query ||
          row.page.title.toLowerCase().includes(query) ||
          row.page.url.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || row.status === statusFilter;
        const matchesType = typeFilter === "all" || row.sourceType === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sort === "newest") return timestamp(b.document?.fetchedAt) - timestamp(a.document?.fetchedAt);
        if (sort === "type") return a.sourceType.localeCompare(b.sourceType);
        if (sort === "status") return a.status.localeCompare(b.status);
        return (a.page.title || a.page.url).localeCompare(b.page.title || b.page.url);
      });
  }, [search, sort, sourceRows, statusFilter, typeFilter]);

  useEffect(() => {
    setVisiblePages(INITIAL_PAGE_ROWS);
    setExpandedSourceId(null);
  }, [search, sort, statusFilter, typeFilter]);

  const retainedDocuments = documents.filter((document) => document.status === "retained").length;
  const visiblePageRows = filteredRows.slice(0, visiblePages);
  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, INITIAL_WARNING_ROWS);
  const hasMorePages = visiblePageRows.length < filteredRows.length;
  const canShowLessPages = visiblePages > INITIAL_PAGE_ROWS;
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
            <div className="grid gap-3 border-b border-white/[.12] bg-black/30 p-4 md:grid-cols-[minmax(0,1fr)_160px_160px_160px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pages or URLs"
                className="min-w-0 rounded-lg border border-white/[.12] bg-black px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25"
              />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-white/[.12] bg-black px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-white/25">
                <option value="all">All statuses</option>
                <option value="retained">Retained</option>
                <option value="skipped">Skipped</option>
                <option value="failed">Failed</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-white/[.12] bg-black px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-white/25">
                <option value="all">All source types</option>
                {sourceTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value as PageSort)} className="rounded-lg border border-white/[.12] bg-black px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-white/25">
                <option value="title">Sort by title</option>
                <option value="newest">Newest fetched</option>
                <option value="type">Source type</option>
                <option value="status">Status</option>
              </select>
            </div>

            {filteredRows.length ? (
              <div className="min-w-0 overflow-x-auto">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,2fr)_minmax(105px,.65fr)_minmax(150px,.85fr)_56px] border-b border-white/[.12] bg-black/60 px-5 py-3 text-center text-[.68rem] font-semibold uppercase tracking-[.1em] text-slate-500">
                    <span>Page</span><span>Source URL</span><span>Type</span><span>Knowledge</span><span />
                  </div>
                  <div className="divide-y divide-white/[.12]">
                    {visiblePageRows.map(({ page, document, sourceType, knowledgeCount }, index) => {
                      const sourceId = page.sourceDocumentId ?? `${page.url}-${index}`;
                      const expanded = expandedSourceId === sourceId;
                      return (
                        <div key={sourceId}>
                          <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,2fr)_minmax(105px,.65fr)_minmax(150px,.85fr)_56px] items-center px-5 py-4">
                            <div className="min-w-0 pr-4 text-left">
                              <a href={page.url} target="_blank" rel="noreferrer" className="group inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-white hover:text-slate-200" title={`Open ${page.title || page.url}`}>
                                <span className="truncate">{page.title || "Untitled page"}</span><span aria-hidden="true" className="shrink-0 text-slate-500 transition group-hover:text-white">↗</span>
                              </a>
                              <p className="mt-1 truncate text-xs text-slate-500" title={path(page.url)}>{path(page.url)}</p>
                            </div>
                            <div className="min-w-0 px-4 text-left">
                              <a href={page.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-slate-300 hover:text-white" title={page.url}>{page.url}</a>
                              <p className="mt-1 truncate text-xs text-slate-500">{document ? `Fetched ${formatDate(document.fetchedAt)}` : host(page.url)}</p>
                            </div>
                            <div className="text-center"><span className="inline-flex rounded-lg border border-white/[.12] bg-black px-2.5 py-1 text-xs font-semibold text-slate-300">{humanize(sourceType)}</span></div>
                            <div className="text-center">
                              <button type="button" onClick={() => setActiveTab("knowledge")} className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3.5 py-2 text-xs font-semibold text-white transition hover:border-amber-300/40">
                                {knowledgeCount ? `View knowledge (${knowledgeCount})` : "View knowledge"}
                              </button>
                            </div>
                            <div className="text-right">
                              <button type="button" onClick={() => setExpandedSourceId(expanded ? null : sourceId)} aria-expanded={expanded} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[.12] bg-black text-sm text-slate-400 transition hover:border-white/25 hover:text-white">{expanded ? "−" : "+"}</button>
                            </div>
                          </div>
                          {expanded ? (
                            <div className="border-t border-white/[.12] bg-black/30 px-5 py-4">
                              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                                <Detail label="Canonical URL" value={document?.canonicalUrl ?? page.url} />
                                <Detail label="Discovery method" value={humanize(document?.discoveryMethod)} />
                                <Detail label="Content type" value={document?.contentType ?? humanize(page.pageType)} />
                                <Detail label="Fetched" value={formatDate(document?.fetchedAt)} />
                                <Detail label="Language" value={document?.language ?? "Not recorded"} />
                                <Detail label="Redirects" value={String(document?.redirectChain.length ?? 0)} />
                                <Detail label="Source truncated" value={document?.sourceTruncated ? "Yes" : "No"} />
                                <Detail label="Extraction truncated" value={document?.extractionTruncated ? "Yes" : "No"} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : <Empty text="No website sources match the current search and filters." />}

            {filteredRows.length > INITIAL_PAGE_ROWS ? (
              <div className="border-t border-white/[.12] px-5 py-4 text-center">
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" disabled={!hasMorePages} onClick={() => setVisiblePages((current) => Math.min(current + PAGE_ROW_INCREMENT, filteredRows.length))} className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35">Show more</button>
                  <button type="button" disabled={!canShowLessPages} onClick={() => setVisiblePages((current) => Math.max(INITIAL_PAGE_ROWS, current - PAGE_ROW_INCREMENT))} className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-35">Show less</button>
                </div>
                <p className="mt-2 text-xs text-slate-600">Showing {visiblePageRows.length} of {filteredRows.length} pages</p>
              </div>
            ) : null}
          </>
        ) : <Empty text="No website source pages are connected to this project." />}
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Crawl details</p>
          <dl className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-white/[.12]">
            <Metric label="Status" value={humanize(String(latestCrawl?.status ?? "not available"))} />
            <Metric label="Duration" value={duration(latestCrawl?.duration_ms)} />
            <Metric label="Discovered" value={String(latestCrawl?.pages_discovered ?? pages.length)} />
            <Metric label="Processed" value={String(latestCrawl?.pages_processed ?? pages.length)} />
            <Metric label="Skipped" value={String(latestCrawl?.pages_skipped ?? 0)} />
            <Metric label="Failed" value={String(latestCrawl?.pages_failed ?? 0)} />
          </dl>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Import warnings</p>
          {warnings.length ? (
            <>
              <div className="mt-4 overflow-hidden rounded-lg border border-white/[.12]"><div className="divide-y divide-white/[.12]">
                {visibleWarnings.map((warning, index) => <div key={`${warning}-${index}`} className="grid grid-cols-[2.25rem_1fr] items-start px-4 py-3.5"><span className="text-center text-xs font-bold text-amber-300">{index + 1}</span><p className="min-w-0 break-words text-sm leading-6 text-slate-300">{warning}</p></div>)}
              </div></div>
              {warnings.length > INITIAL_WARNING_ROWS ? <div className="mt-4 flex justify-center gap-2"><button type="button" disabled={!hasMoreWarnings} onClick={() => setShowAllWarnings(true)} className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25 disabled:opacity-35">Show more</button><button type="button" disabled={!showAllWarnings} onClick={() => setShowAllWarnings(false)} className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25 disabled:opacity-35">Show less</button></div> : null}
            </>
          ) : <Empty text="No import warnings were recorded for this website source." compact />}
        </section>
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505]">
        <div className="border-b border-white/[.12] px-5 py-4 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Crawl history</p></div>
        {crawls.length ? (
          <div className="overflow-x-auto"><div className="min-w-[680px]">
            <div className="grid grid-cols-[1.4fr_.8fr_.7fr_.7fr] border-b border-white/[.12] bg-black/60 px-5 py-3 text-center text-[.68rem] font-semibold uppercase tracking-[.1em] text-slate-500"><span>Started</span><span>Duration</span><span>Pages</span><span>Status</span></div>
            <div className="divide-y divide-white/[.12]">{crawls.slice(0, CRAWL_HISTORY_ROWS).map((crawl, index) => <div key={`${String(crawl.started_at)}-${index}`} className="grid grid-cols-[1.4fr_.8fr_.7fr_.7fr] items-center px-5 py-3.5 text-center"><span className="text-sm text-slate-300">{formatDate(crawl.started_at)}</span><span className="text-sm font-semibold text-white">{duration(crawl.duration_ms)}</span><span className="text-sm font-semibold text-white">{String(crawl.pages_processed ?? 0)}</span><span className="text-xs font-bold capitalize text-slate-300">{humanize(String(crawl.status ?? "unknown"))}</span></div>)}</div>
          </div></div>
        ) : <Empty text="No crawl attempts have been recorded yet." compact />}
      </section>
    </div>
  );
}

function Summary({ label, value, detail, compact = false }: { label: string; value: string; detail: string; compact?: boolean }) {
  return <article className="min-w-0 rounded-[18px] border border-white/[.12] bg-[#070707] p-5 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{label}</p><p className={`mt-2 truncate font-semibold text-white ${compact ? "text-base" : "text-2xl"}`} title={value}>{value}</p><p className="mt-2 truncate text-xs leading-5 text-slate-500" title={detail}>{detail}</p></article>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-r border-white/[.12] bg-black/40 px-3.5 py-3 text-center even:border-r-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 truncate text-sm font-semibold text-white" title={value}>{value}</dd></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[.68rem] font-bold uppercase tracking-[.1em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm leading-5 text-slate-300">{value}</p></div>;
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={`${compact ? "mt-4 min-h-[170px]" : "min-h-[280px]"} flex items-center justify-center px-5 text-center text-sm leading-6 text-slate-600`}>{text}</div>;
}
