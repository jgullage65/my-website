"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
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
  String(value ?? "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const sourceTypeLabel = (value: string | null | undefined) => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "rendered_html") return "Processed page";
  if (normalized === "html") return "Website page";
  if (normalized === "pdf") return "PDF document";
  return humanize(value);
};

const importStatusLabel = (value: unknown) => {
  const normalized = String(value ?? "").toLowerCase();
  if (["completed", "success", "succeeded", "retained"].includes(normalized)) return "Imported";
  if (["partial", "partially_completed"].includes(normalized)) return "Partially imported";
  if (["failed", "error"].includes(normalized)) return "Could not import";
  if (["skipped", "cancelled", "canceled"].includes(normalized)) return "Skipped";
  if (["running", "processing", "extracting"].includes(normalized)) return "Importing";
  if (["queued", "pending"].includes(normalized)) return "Waiting to import";
  return normalized ? humanize(normalized) : "Not available";
};

const plainWarning = (value: string) => {
  const warning = value.replace(/\s+/g, " ").trim();
  const lower = warning.toLowerCase();

  if (/json[- ]?ld|structured data|structured metadata|malformed json/.test(lower)) {
    return "Some hidden website information could not be read. Visible page content was still imported.";
  }
  if (/rate limit|too many requests|429/.test(lower)) {
    return "The website temporarily limited access, so some pages may not have been imported.";
  }
  if (/access denied|forbidden|unauthorized|\b401\b|\b403\b/.test(lower)) {
    return "The website blocked access to part of its content, so some pages could not be imported.";
  }
  if (/timed? out|timeout/.test(lower) && /render|browser|javascript/.test(lower)) {
    return "A page took too long to finish loading, so its dynamic content could not be imported.";
  }
  if (/timed? out|timeout/.test(lower)) {
    return "A page took too long to respond and could not be imported.";
  }
  if (/browser|render|javascript|playwright/.test(lower)) {
    return "Some dynamic page content could not be fully loaded during the import.";
  }
  if (/pdf/.test(lower) && /large|limit|truncat|too many pages/.test(lower)) {
    return "A PDF was too large to import completely, so only part of it was included.";
  }
  if (/pdf/.test(lower) && /fail|error|parse|read/.test(lower)) {
    return "A PDF could not be read and was not included in the imported knowledge.";
  }
  if (/response too large|exceeds.*limit|content.*too large|maximum.*size/.test(lower)) {
    return "A page was too large to import completely, so some content was left out.";
  }
  if (/truncat|cut off/.test(lower)) {
    return "Some content was too large to import completely, so only the most useful portion was included.";
  }
  if (/redirect/.test(lower) && /block|fail|unsafe|loop|too many/.test(lower)) {
    return "A page redirected somewhere the importer could not safely follow.";
  }
  if (/unsafe destination|private address|blocked destination/.test(lower)) {
    return "A page led to a restricted destination and was not opened.";
  }
  if (/unsupported content|content type|unsupported protocol/.test(lower)) {
    return "A file type on the website is not supported and was not imported.";
  }
  if (/duplicate|near duplicate|same content|already imported/.test(lower)) {
    return "Repeated page content was skipped so the same information would not be imported twice.";
  }
  if (/sitemap/.test(lower) && /fail|error|invalid|reject/.test(lower)) {
    return "The website's page directory could not be fully read, but other pages were still discovered normally.";
  }
  if (/404|not found/.test(lower)) {
    return "A linked page could not be found and was not imported.";
  }
  if (/fetch|request|network|connection/.test(lower) && /fail|error|closed|reset/.test(lower)) {
    return "A page could not be reached during the import.";
  }
  if (/extract|parse|read/.test(lower) && /fail|error|unable|could not/.test(lower)) {
    return "A page opened, but its useful content could not be read.";
  }

  return "Some website content could not be imported completely. The rest of the available content was still processed.";
};

const timestamp = (value: unknown) => {
  const parsed = value ? new Date(String(value)).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const normalizeUrl = (value: string | null | undefined) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

const sentence = (value: string) => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
};

export default function AiBuilderSources() {
  const { websiteKnowledge, diagnostics, session } = useAiBuilderWorkspace();
  const [visiblePages, setVisiblePages] = useState(INITIAL_PAGE_ROWS);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<PageSort>("title");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const scrollPositionRef = useRef(0);

  const pages = websiteKnowledge?.pages ?? [];
  const warnings = websiteKnowledge?.warnings ?? [];
  const customerWarnings = useMemo(
    () => Array.from(new Set(warnings.map(plainWarning))),
    [warnings],
  );
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
    const byUrl = new Map<string, typeof session.contextEntries>();
    for (const entry of session.contextEntries) {
      const url = normalizeUrl(entry.source.sourceUrl);
      if (entry.source.sourceType !== "website" || !url) continue;
      const existing = byUrl.get(url) ?? [];
      existing.push(entry);
      byUrl.set(url, existing);
    }
    return byUrl;
  }, [session.contextEntries]);

  const sourceRows = useMemo(
    () =>
      pages.map((page) => {
        const document = page.sourceDocumentId ? documentById.get(page.sourceDocumentId) : undefined;
        const knowledge = knowledgeByUrl.get(normalizeUrl(page.url)) ?? [];
        const topics = Array.from(
          new Set(
            knowledge.flatMap((entry) =>
              [humanize(entry.category), ...entry.metadata.tags.map((tag) => humanize(tag))].filter(Boolean),
            ),
          ),
        ).slice(0, 8);
        const confidenceOrder = { low: 0, medium: 1, high: 2 } as const;
        const confidence = knowledge.length
          ? knowledge.reduce(
              (best, entry) => confidenceOrder[entry.confidence] < confidenceOrder[best] ? entry.confidence : best,
              knowledge[0]!.confidence,
            )
          : null;
        const summary = knowledge.length
          ? knowledge.slice(0, 3).map((entry) => sentence(entry.content)).filter(Boolean).join(" ")
          : "No Business Knowledge was generated from this page.";
        const importNotes = [
          document?.sourceTruncated ? "This page was too large to import completely, so only the most useful content was included." : null,
          document?.extractionTruncated ? "Some content was left out because the page contained more information than could be processed at once." : null,
          document?.sourceType === "rendered_html" ? "This page needed extra processing before its content could be read." : null,
          document?.sourceType === "pdf" ? "This PDF was successfully converted into readable content." : null,
          document?.status === "skipped" ? "This page was not included in the imported knowledge." : null,
          document?.status === "failed" ? "This page could not be imported." : null,
        ].filter((note): note is string => Boolean(note));

        return {
          id: page.sourceDocumentId ?? page.url,
          page,
          document,
          status: document?.status ?? "retained",
          sourceType: document?.sourceType ?? page.pageType,
          knowledge,
          knowledgeCount: knowledge.length,
          topics,
          confidence,
          summary,
          importNotes,
        };
      }),
    [documentById, knowledgeByUrl, pages],
  );

  const selectedSource = sourceRows.find((row) => row.id === selectedSourceId) ?? null;

  const sourceTypes = useMemo(
    () => Array.from(new Set(sourceRows.map((row) => row.sourceType).filter(Boolean))).sort(),
    [sourceRows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sourceRows
      .filter((row) => {
        const matchesSearch = !query || row.page.title.toLowerCase().includes(query) || row.page.url.toLowerCase().includes(query);
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

  const openSourceSummary = (sourceId: string) => {
    scrollPositionRef.current = window.scrollY;
    setSelectedSourceId(sourceId);
  };

  const closeSourceSummary = () => {
    setSelectedSourceId(null);
    requestAnimationFrame(() => window.scrollTo({ top: scrollPositionRef.current, behavior: "auto" }));
  };

  useEffect(() => {
    setVisiblePages(INITIAL_PAGE_ROWS);
    setSelectedSourceId(null);
  }, [search, sort, statusFilter, typeFilter]);

  useEffect(() => {
    if (!selectedSourceId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSourceSummary();
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [selectedSourceId]);

  const retainedDocuments = documents.filter((document) => document.status === "retained").length;
  const visiblePageRows = filteredRows.slice(0, visiblePages);
  const visibleWarnings = showAllWarnings ? customerWarnings : customerWarnings.slice(0, INITIAL_WARNING_ROWS);
  const hasMorePages = visiblePageRows.length < filteredRows.length;
  const canShowLessPages = visiblePages > INITIAL_PAGE_ROWS;
  const hasMoreWarnings = visibleWarnings.length < customerWarnings.length;

  return (
    <>
      <div className="min-w-0 max-w-full space-y-5 overflow-hidden pb-2">
        <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Connected website" value={host(websiteKnowledge?.resolved_url)} detail={websiteKnowledge?.resolved_url ? "Active website source" : "No website connected"} />
          <Summary label="Pages imported" value={String(pages.length)} detail={`${retainedDocuments} imported page${retainedDocuments === 1 ? "" : "s"}`} />
          <Summary label="Content sections" value={String(blocks.length)} detail="Readable sections found across the website" />
          <Summary label="Last import" value={formatDate(websiteKnowledge?.imported_at)} detail={`${customerWarnings.length} import note${customerWarnings.length === 1 ? "" : "s"}`} compact />
        </section>

        <section className="min-w-0 max-w-full overflow-hidden rounded-xl border border-white/[.12] bg-[#050505]">
          <div className="border-b border-white/[.12] px-5 py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Website sources</p>
            <p className="mt-2 text-sm text-slate-400">Pages currently connected to this project</p>
          </div>

          {pages.length ? (
            <>
              <div className="grid min-w-0 gap-3 border-b border-white/[.12] bg-black/30 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_160px]">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pages or URLs" className="min-w-0 rounded-lg border border-white/[.12] bg-black px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25 sm:col-span-2 xl:col-span-1" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-w-0 rounded-lg border border-white/[.12] bg-black px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-white/25">
                  <option value="all">All import results</option><option value="retained">Imported</option><option value="skipped">Skipped</option><option value="failed">Could not import</option>
                </select>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-w-0 rounded-lg border border-white/[.12] bg-black px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-white/25">
                  <option value="all">All page types</option>{sourceTypes.map((type) => <option key={type} value={type}>{sourceTypeLabel(type)}</option>)}
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value as PageSort)} className="min-w-0 rounded-lg border border-white/[.12] bg-black px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-white/25 sm:col-span-2 xl:col-span-1">
                  <option value="title">Sort by title</option><option value="newest">Newest imported</option><option value="type">Page type</option><option value="status">Import result</option>
                </select>
              </div>

              {filteredRows.length ? (
                <div className="divide-y divide-white/[.12]">
                  {visiblePageRows.map(({ id, page, document, sourceType, knowledgeCount }) => (
                    <div key={id} className="grid min-w-0 gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-[.65rem] font-bold uppercase tracking-[.1em] text-slate-500 lg:hidden">Page</p>
                        <a href={page.url} target="_blank" rel="noreferrer" className="group mt-1 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-white hover:text-slate-200 lg:mt-0" title={`Open ${page.title || page.url}`}>
                          <span className="min-w-0 break-words">{page.title || "Untitled page"}</span><span aria-hidden="true" className="shrink-0 text-slate-500 transition group-hover:text-white">↗</span>
                        </a>
                        <p className="mt-1 break-all text-xs leading-5 text-slate-500">{path(page.url)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[.65rem] font-bold uppercase tracking-[.1em] text-slate-500 lg:hidden">Source URL</p>
                        <a href={page.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm leading-5 text-slate-300 hover:text-white lg:mt-0">{page.url}</a>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-500">{document ? `Imported ${formatDate(document.fetchedAt)}` : host(page.url)} · {sourceTypeLabel(sourceType)}</p>
                      </div>
                      <div className="flex min-w-0 flex-wrap justify-start gap-2 lg:justify-end">
                        <button
                          type="button"
                          disabled={!knowledgeCount}
                          onClick={() => knowledgeCount && openSourceSummary(id)}
                          className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3.5 py-2 text-xs font-semibold text-white transition hover:border-amber-300/40 disabled:cursor-not-allowed disabled:border-white/[.08] disabled:text-slate-600 disabled:shadow-none"
                        >
                          {knowledgeCount ? `View knowledge (${knowledgeCount})` : "No knowledge generated"}
                        </button>
                        <button type="button" onClick={() => openSourceSummary(id)} aria-label="Open AI source summary" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[.12] bg-black text-sm text-slate-400 transition hover:border-white/25 hover:text-white">+</button>
                      </div>
                    </div>
                  ))}
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

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 space-y-5">
            <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
              <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Latest import</p>
              <dl className="mt-4 grid min-w-0 grid-cols-2 overflow-hidden rounded-lg border border-white/[.12]">
                <Metric label="Result" value={importStatusLabel(latestCrawl?.status)} /><Metric label="Time taken" value={duration(latestCrawl?.duration_ms)} /><Metric label="Pages found" value={String(latestCrawl?.pages_discovered ?? pages.length)} /><Metric label="Pages imported" value={String(latestCrawl?.pages_processed ?? pages.length)} /><Metric label="Pages skipped" value={String(latestCrawl?.pages_skipped ?? 0)} /><Metric label="Pages missed" value={String(latestCrawl?.pages_failed ?? 0)} />
              </dl>
            </section>
            <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
              <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Import history</p>
              {crawls.length ? <div className="mt-4 overflow-hidden rounded-lg border border-white/[.12]"><div className="divide-y divide-white/[.12]">{crawls.slice(0, CRAWL_HISTORY_ROWS).map((crawl, index) => <div key={`${String(crawl.started_at)}-${index}`} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 bg-black/40 px-4 py-3.5"><HistoryItem label="Started" value={formatDate(crawl.started_at)} /><HistoryItem label="Result" value={importStatusLabel(crawl.status)} /><HistoryItem label="Time taken" value={duration(crawl.duration_ms)} /><HistoryItem label="Pages imported" value={String(crawl.pages_processed ?? 0)} /></div>)}</div></div> : <Empty text="No website imports have been recorded yet." compact />}
            </section>
          </div>
          <section className="min-w-0 overflow-hidden rounded-xl border border-white/[.12] bg-[#050505] p-5">
            <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">Import notes</p>
            {customerWarnings.length ? <><div className="mt-4 overflow-hidden rounded-lg border border-white/[.12]"><div className="divide-y divide-white/[.12]">{visibleWarnings.map((warning, index) => <div key={`${warning}-${index}`} className="grid grid-cols-[2.25rem_1fr] items-start px-4 py-3.5"><span className="text-center text-xs font-bold text-amber-300">{index + 1}</span><p className="min-w-0 break-words text-sm leading-6 text-slate-300">{warning}</p></div>)}</div></div>{customerWarnings.length > INITIAL_WARNING_ROWS ? <div className="mt-4 flex justify-center gap-2"><button type="button" disabled={!hasMoreWarnings} onClick={() => setShowAllWarnings(true)} className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25 disabled:opacity-35">Show more</button><button type="button" disabled={!showAllWarnings} onClick={() => setShowAllWarnings(false)} className="rounded-lg border border-white/[.12] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/25 disabled:opacity-35">Show less</button></div> : null}</> : <Empty text="Everything available was imported without any notable issues." compact />}
          </section>
        </div>
      </div>

      {selectedSource ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSourceSummary(); }}>
          <section role="dialog" aria-modal="true" aria-label="AI source summary" className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-white/[.1] bg-[#080808] shadow-[0_28px_90px_rgba(0,0,0,.65)]">
            <header className="sticky top-0 z-10 relative flex items-center justify-center border-b border-white/[.08] bg-[#080808]/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0 px-20 text-center">
                <p className="text-[.66rem] font-semibold uppercase tracking-[.22em] text-slate-500">What the AI learned</p>
                <h2 className="mt-1 break-words text-base font-semibold text-white">{selectedSource.page.title || "Untitled page"}</h2>
              </div>
              <button type="button" onClick={closeSourceSummary} className="absolute right-5 top-1/2 min-h-10 -translate-y-1/2 rounded-lg border border-white/[.08] bg-black px-4 py-2 text-xs font-semibold text-white transition hover:border-white/20">Done</button>
            </header>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="rounded-xl border border-white/[.08] bg-black/30 p-4">
                <p className="text-center text-[.68rem] font-bold uppercase tracking-[.14em] text-slate-500">AI summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">{selectedSource.summary}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ModalMetric label="Knowledge created" value={selectedSource.knowledgeCount ? `${selectedSource.knowledgeCount} ${selectedSource.knowledgeCount === 1 ? "entry" : "entries"}` : "None"} />
                <ModalMetric label="Confidence" value={selectedSource.confidence ? humanize(selectedSource.confidence) : "Not available"} />
              </div>

              {selectedSource.topics.length ? (
                <section className="text-center">
                  <p className="text-[.68rem] font-bold uppercase tracking-[.14em] text-slate-500">Topics found</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">{selectedSource.topics.map((topic) => <span key={topic} className="rounded-lg border border-white/[.1] bg-black px-2.5 py-1.5 text-xs font-semibold text-slate-300">{topic}</span>)}</div>
                </section>
              ) : null}

              {selectedSource.knowledge.length ? (
                <section>
                  <p className="text-center text-[.68rem] font-bold uppercase tracking-[.14em] text-slate-500">Knowledge from this page</p>
                  <div className="mt-3 space-y-3">
                    {selectedSource.knowledge.map((entry) => (
                      <article key={entry.id} className="rounded-xl border border-white/[.08] bg-black/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
                          <span className="rounded-lg border border-white/[.08] bg-black px-2.5 py-1 text-[.65rem] font-semibold text-slate-400">{humanize(entry.status)}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{entry.content}</p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
                          <span>{humanize(entry.category)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{humanize(entry.confidence)} confidence</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {selectedSource.importNotes.length ? (
                <section>
                  <p className="text-center text-[.68rem] font-bold uppercase tracking-[.14em] text-slate-500">Import notes</p>
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/[.08] bg-black/30 divide-y divide-white/[.08]">{selectedSource.importNotes.map((note) => <p key={note} className="px-4 py-3 text-sm leading-6 text-slate-300">{note}</p>)}</div>
                </section>
              ) : null}

              <div className="flex justify-center border-t border-white/[.08] pt-5">
                <a href={selectedSource.page.url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-center text-sm text-slate-400 transition hover:text-white">Open original page ↗</a>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Summary({ label, value, detail, compact = false }: { label: string; value: string; detail: string; compact?: boolean }) {
  return <article className="min-w-0 rounded-[18px] border border-white/[.12] bg-[#070707] p-5 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{label}</p><p className={`mt-2 break-words font-semibold text-white ${compact ? "text-base" : "text-2xl"}`} title={value}>{value}</p><p className="mt-2 break-words text-xs leading-5 text-slate-500" title={detail}>{detail}</p></article>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-r border-white/[.12] bg-black/40 px-3.5 py-3 text-center even:border-r-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-white" title={value}>{value}</dd></div>;
}

function HistoryItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 text-center"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-white">{value}</p></div>;
}

function ModalMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.08] bg-black/30 px-4 py-5 text-center"><p className="text-lg font-semibold text-white">{value}</p><p className="mt-2 text-[.64rem] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p></div>;
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={`${compact ? "mt-4 min-h-[170px]" : "min-h-[280px]"} flex items-center justify-center px-5 text-center text-sm leading-6 text-slate-600`}>{text}</div>;
}
