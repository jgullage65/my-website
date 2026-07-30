"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import AiBuilderAuthCta, { aiBuilderCornerCtaClassName } from "./AiBuilderAuthCta";
import AiBuilderModelSelect, { type AiBuilderModelChoice } from "./AiBuilderModelSelect";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import type { BuilderState, UserKnowledge, WebsiteKnowledge } from "./AiBuilderClient";
import type { StructuredWebsiteKnowledge, WebsiteKnowledgeFact, WebsiteKnowledgePage } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "@/app/lib/ai-engine/crawler/websiteSourceRecords";
import { WEBSITE_KNOWLEDGE_SECTION_LABELS, WEBSITE_KNOWLEDGE_SECTION_ORDER } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

type Props = {
  value: BuilderState;
  projectId?: string | null;
  onChange: (value: BuilderState) => void;
  onBuild: () => void;
  demoMode?: boolean;
};

type WebsiteImportError = {
  code?: string;
  message?: string;
  modelId?: string;
  provider?: string;
  gateway?: string;
  requestId?: string | null;
};

type WebsiteImportPayload = {
  ok?: boolean;
  crawlAttemptId?: string;
  import?: {
    businessName?: string;
    industry?: string;
    website?: string;
    requestedUrl?: string;
    resolvedUrl?: string;
    productsServices?: string;
    idealCustomers?: string;
    additionalKnowledge?: string;
  };
  knowledge?: StructuredWebsiteKnowledge;
  pages?: WebsiteKnowledgePage[];
  warnings?: string[];
  sourceDocuments?: WebsiteSourceDocumentRecord[];
  sourceBlocks?: WebsiteSourceBlockRecord[];
  error?: WebsiteImportError;
};

type WebsiteImportEvent =
  | { type: "progress"; percent: number }
  | { type: "crawl_progress"; pagesCrawled: number; pagesDiscovered: number }
  | { type: "crawl_complete"; pagesCrawled: number; pagesDiscovered: number }
  | ({ type: "result" } & WebsiteImportPayload)
  | { type: "error"; error?: WebsiteImportError; crawlAttemptId?: string };

const inputClassName =
  "w-full rounded-xl border border-white/10 bg-[#020202] px-4 py-3 text-center text-sm text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-center placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-4 focus:ring-amber-400/5";

const cardClassName =
  "rounded-2xl border border-amber-300/20 bg-[#070707]/88 p-5 shadow-[0_14px_42px_rgba(0,0,0,0.2)]";

function formatImportError(error: WebsiteImportError | undefined, fallback: string) {
  const message = error?.message || fallback;
  const diagnostics = [
    error?.modelId ? `model ${error.modelId}` : null,
    error?.provider ? `provider ${error.provider}` : null,
    error?.gateway ? `gateway ${error.gateway}` : null,
    error?.requestId ? `request ${error.requestId}` : null,
  ].filter(Boolean);
  return diagnostics.length ? `${message} (${diagnostics.join(", ")})` : message;
}

export default function AiBuilderForm({ value, projectId, onChange, onBuild, demoMode = false }: Props) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [crawlPages, setCrawlPages] = useState(0);
  const [importStage, setImportStage] = useState<"crawl" | "processing" | "complete">("crawl");
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showWebsiteKnowledge, setShowWebsiteKnowledge] = useState(false);
  const [modelId, setModelId] = useState("");
  const [modelChoices, setModelChoices] = useState<AiBuilderModelChoice[]>([]);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  useEffect(() => {
    if (demoMode) return;
    void fetch("/api/ai-builder/models?purpose=crawl")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) {
          setModelChoices(payload.models);
          setModelId(payload.defaultModelId);
        }
      })
      .catch(() => undefined);
  }, [demoMode]);

  async function selectModel(next: string) {
    const choice = modelChoices.find((model) => model.id === next);
    if (!choice || importing) return;
    if (choice.highUsage) {
      const confirmed = await showConfirm({
        title: `Use ${choice.displayName}?`,
        message: `${choice.displayName} uses significantly more AI usage than the other available models. Continue?`,
        cancelLabel: "Cancel",
        confirmLabel: `Use ${choice.displayName}`,
      });
      if (!confirmed) return;
    }
    setModelId(next);
  }

  useEffect(() => {
    if (!importing || importStage !== "processing") return;
    const timer = window.setInterval(() => {
      setImportProgress((current) => {
        if (current >= 96) return current;
        if (current < 20) return current + 2;
        if (current < 50) return current + 1;
        return current + 0.5;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [importing, importStage]);

  const updateProfile = (key: "businessName" | "industry" | "website" | "tone", nextValue: string) =>
    onChange({ ...value, [key]: nextValue });

  const updateUserKnowledge = (key: keyof UserKnowledge, nextValue: string) => {
    onChange({ ...value, userKnowledge: { ...value.userKnowledge, [key]: nextValue } });
  };

  const importWebsite = async () => {
    if (demoMode) return;
    const website = value.website.trim();
    if (!website || importing) return;

    setImporting(true);
    setImportProgress(0);
    setCrawlPages(0);
    setImportStage("crawl");
    setImportError(null);
    setImportMessage(null);

    try {
      const response = await fetch("/api/ai-builder/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website, modelId, projectId }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json()) as WebsiteImportPayload;
        throw new Error(formatImportError(payload.error, "The website could not be imported."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let payload: WebsiteImportPayload | null = null;

      const handleEvent = (event: WebsiteImportEvent) => {
        if (event.type === "crawl_progress") {
          setCrawlPages(event.pagesCrawled);
          return;
        }
        if (event.type === "crawl_complete") {
          setCrawlPages(event.pagesCrawled);
          setImportStage("processing");
          setImportProgress((current) => Math.max(current, 70));
          return;
        }
        if (event.type === "progress") {
          if (event.percent >= 70 && event.percent < 100) setImportStage("processing");
          setImportProgress((current) => Math.max(current, event.percent));
          return;
        }
        if (event.type === "error") {
          if (event.crawlAttemptId && !value.crawlAttemptIds.includes(event.crawlAttemptId)) {
            onChange({ ...value, crawlAttemptIds: [...value.crawlAttemptIds, event.crawlAttemptId] });
          }
          throw new Error(formatImportError(event.error, "The website could not be imported."));
        }
        setImportStage("processing");
        setImportProgress((current) => Math.max(current, 96));
        payload = event;
      };

      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line) as WebsiteImportEvent);
        }
        if (done) {
          if (buffer.trim()) handleEvent(JSON.parse(buffer) as WebsiteImportEvent);
          break;
        }
      }

      if (!payload?.ok || !payload.import) {
        throw new Error(formatImportError(payload?.error, "The website could not be imported."));
      }

      const imported = payload.import;
      const websiteKnowledge: WebsiteKnowledge = {
        businessName: imported.businessName?.trim() || "",
        industry: imported.industry?.trim() || "",
        website: imported.website?.trim() || website,
        requestedUrl: imported.requestedUrl?.trim() || website,
        resolvedUrl: imported.resolvedUrl?.trim() || imported.website?.trim() || website,
        productsServices: imported.productsServices?.trim() || "",
        idealCustomers: imported.idealCustomers?.trim() || "",
        additionalKnowledge: imported.additionalKnowledge?.trim() || "",
        knowledge: payload.knowledge,
        pages: payload.pages ?? [],
        warnings: payload.warnings ?? [],
        importedAt: new Date().toISOString(),
        crawlAttemptId: payload.crawlAttemptId,
        sourceDocuments: payload.sourceDocuments ?? [],
        sourceBlocks: payload.sourceBlocks ?? [],
      };

      onChange({
        ...value,
        crawlAttemptIds:
          payload.crawlAttemptId && !value.crawlAttemptIds.includes(payload.crawlAttemptId)
            ? [...value.crawlAttemptIds, payload.crawlAttemptId]
            : value.crawlAttemptIds,
        businessName: value.businessName.trim() ? value.businessName : websiteKnowledge.businessName,
        industry: value.industry.trim() ? value.industry : websiteKnowledge.industry,
        website: websiteKnowledge.website,
        websiteKnowledge,
      });

      setImportProgress(100);
      setImportStage("complete");
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const pageCount = websiteKnowledge.pages.length;
      setImportMessage(`Imported ${pageCount} page${pageCount === 1 ? "" : "s"}. Your expertise remains separate and always takes priority.`);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "The website could not be imported.");
    } finally {
      setImporting(false);
    }
  };

  const valid = Boolean(
    value.businessName.trim() &&
      value.industry.trim() &&
      (value.userKnowledge.productsServices.trim() || value.websiteKnowledge?.productsServices.trim()) &&
      (value.userKnowledge.idealCustomers.trim() || value.websiteKnowledge?.idealCustomers.trim()),
  );

  return (
    <div className="w-full pb-10 min-[1200px]:px-8">
      <div className="relative bg-[#000000] px-4 py-8 sm:px-6 sm:py-10 min-[1200px]:rounded-[28px] min-[1200px]:border min-[1200px]:border-white/[0.09] min-[1200px]:p-8 min-[1200px]:shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
        <AiBuilderAuthCta />
        <Link href="/ai-builder" className={`${aiBuilderCornerCtaClassName} absolute left-4 top-4 z-10 sm:left-6 lg:left-8`}>← AI Projects</Link>

        <div className="mt-12 space-y-6 min-[1200px]:mt-0 min-[1200px]:grid min-[1200px]:grid-cols-[minmax(25rem,0.8fr)_minmax(34rem,1.2fr)] min-[1200px]:items-start min-[1200px]:gap-x-10 min-[1200px]:gap-y-8 min-[1200px]:space-y-0">
          <div className="space-y-6 min-[1200px]:self-start min-[1200px]:pt-7">
            <header className="grid justify-items-center gap-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">AI Builder</p>
              <AiBuilderModelSelect models={modelChoices} value={modelId} disabled={importing} onChange={(next) => void selectModel(next)} />
            </header>

            <section>
              <article className={`${cardClassName} relative overflow-hidden text-center`}>
                <div className="relative">
                  <span className={`absolute right-0 top-0 rounded-full border px-3 py-1 text-xs font-semibold max-[640px]:-right-2 max-[640px]:-top-2 ${value.websiteKnowledge ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                    {value.websiteKnowledge ? "Active" : "Optional"}
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 max-[640px]:pt-8">{value.websiteKnowledge ? "Website connected" : "Connect your website"}</p>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">We safely crawl public pages and organize the useful information into a read-only source.</p>

                  {value.websiteKnowledge ? (
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <Metric label="Pages" value={String(value.websiteKnowledge.pages.length)} />
                      <Metric label="Warnings" value={String(value.websiteKnowledge.warnings.length)} />
                      <Metric label="Updated" value={new Date(value.websiteKnowledge.importedAt).toLocaleDateString()} />
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3">
                    <input type="url" className={inputClassName} placeholder="https://yourbusiness.com" value={value.website} onChange={(event) => updateProfile("website", event.target.value)} />
                    <button type="button" disabled={!value.website.trim() || importing} onClick={importWebsite} className="mx-auto inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111] disabled:cursor-not-allowed disabled:border-[rgba(212,175,55,0.18)] disabled:bg-[#000000] disabled:text-white disabled:shadow-none disabled:[border-width:0.5px] disabled:hover:translate-y-0 disabled:hover:border-[rgba(212,175,55,0.18)] disabled:hover:bg-[#000000]">
                      {importing
                        ? importStage === "crawl"
                          ? `${crawlPages} page${crawlPages === 1 ? "" : "s"} crawled`
                          : importStage === "processing"
                            ? `Building Business Memory… ${Math.round(importProgress)}%`
                            : "Business Memory complete"
                        : value.websiteKnowledge
                          ? "Re-import Website"
                          : "Import Website"}
                    </button>
                  </div>

                  {importError ? <Status tone="error">{importError}</Status> : null}
                  {importMessage ? <Status tone="success">{importMessage}</Status> : null}
                  {value.websiteKnowledge ? (
                    <button type="button" onClick={() => setShowWebsiteKnowledge(true)} className="cta-raised mt-4 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#111111]">View imported knowledge →</button>
                  ) : null}
                </div>
              </article>
            </section>

            <section className={`${cardClassName} mx-auto text-center min-[1200px]:w-full min-[1200px]:py-4`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Communication style</p>
              <h3 className="mt-2 text-xl font-semibold text-white">How should your AI sound?</h3>
              <div className="relative mt-4">
                <select className={`${inputClassName} appearance-none px-12`} value={value.tone} onChange={(event) => updateProfile("tone", event.target.value)}>
                  <option>Professional</option><option>Friendly</option><option>Consultative</option><option>Direct</option><option>Warm</option>
                </select>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </section>
          </div>

          <section className="min-w-0 space-y-5 min-[1200px]:col-start-2 min-[1200px]:row-start-1 min-[1200px]:space-y-5">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Your expertise</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Your answers always take priority over imported website knowledge.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 min-[1200px]:grid-cols-2 min-[1200px]:gap-4">
              <KnowledgeCard title="Business profile">
                <Field label="Business name" required><input className={inputClassName} placeholder="JG Creative Studio" value={value.businessName} onChange={(event) => updateProfile("businessName", event.target.value)} /></Field>
                <Field label="Industry / business type" required><input className={inputClassName} placeholder="Web design and AI automation agency" value={value.industry} onChange={(event) => updateProfile("industry", event.target.value)} /></Field>
              </KnowledgeCard>
              <KnowledgeCard title="Products & Services" fill><textarea rows={6} className={`${inputClassName} resize-y min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:resize-none`} placeholder={value.websiteKnowledge?.productsServices ? "Add private details, corrections, packages, pricing, or anything your website does not explain." : "Describe your services, packages, deliverables, pricing structure, and what each option is for."} value={value.userKnowledge.productsServices} onChange={(event) => updateUserKnowledge("productsServices", event.target.value)} /></KnowledgeCard>
              <KnowledgeCard title="Ideal Customers" fill><textarea rows={6} className={`${inputClassName} resize-y min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:resize-none`} placeholder={value.websiteKnowledge?.idealCustomers ? "Add more specific customer details or correct anything the website got wrong." : "Describe your best-fit customers, industries, company sizes, locations, needs, and goals."} value={value.userKnowledge.idealCustomers} onChange={(event) => updateUserKnowledge("idealCustomers", event.target.value)} /></KnowledgeCard>
              <KnowledgeCard title="Additional Business Knowledge" fill><textarea rows={6} className={`${inputClassName} resize-y min-[1200px]:h-full min-[1200px]:min-h-0 min-[1200px]:resize-none`} placeholder="Share private pricing, policies, processes, guarantees, objections, FAQs, and anything else your AI should know." value={value.userKnowledge.additionalKnowledge} onChange={(event) => updateUserKnowledge("additionalKnowledge", event.target.value)} /></KnowledgeCard>
            </div>
          </section>

          <section className={`${cardClassName} mx-auto text-center min-[1200px]:col-span-2 min-[1200px]:row-start-2 min-[1200px]:w-full min-[1200px]:max-w-[44rem] min-[1200px]:justify-self-center min-[1200px]:py-4`}>
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Final step</p><h3 className="mt-2 text-xl font-semibold text-white">Ready to build your AI?</h3><button type="button" disabled={!valid || importing} onClick={onBuild} className={`${aiBuilderCornerCtaClassName} mt-4 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0`}>Build My AI</button></div>
          </section>
        </div>
      </div>

      {showWebsiteKnowledge && value.websiteKnowledge ? <WebsiteKnowledgeModal knowledge={value.websiteKnowledge} onClose={() => setShowWebsiteKnowledge(false)} /> : null}
      {confirmDialogNode}
    </div>
  );
}

function KnowledgeCard({ title, children, fill = false }: { title: string; children: ReactNode; fill?: boolean }) {
  return <article className={`${cardClassName} ${fill ? "min-[1200px]:flex min-[1200px]:h-full min-[1200px]:flex-col" : ""}`}><h3 className="text-center text-lg font-semibold text-white">{title}</h3><div className={`${fill ? "min-[1200px]:mt-2 min-[1200px]:flex min-[1200px]:flex-1 min-[1200px]:flex-col" : "mt-4 grid gap-4"}`}>{children}</div></article>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="grid gap-2 text-center"><span className="text-sm font-semibold text-slate-200">{label}{required ? <span className="text-amber-300"> *</span> : null}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-center"><p className="text-base font-semibold text-white">{value}</p><p className="mt-1 text-[0.68rem] text-slate-500">{label}</p></div>;
}

function Status({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return <div role="status" className={`mx-auto mt-4 px-4 py-3 text-sm ${tone === "success" ? "cta-raised flex w-full items-center justify-center rounded-lg border border-amber-300/15 bg-[#000000] font-semibold text-white" : "rounded-xl border border-red-400/20 bg-red-400/[0.07] text-red-200"}`}>{children}</div>;
}

function WebsiteKnowledgeModal({ knowledge, onClose }: { knowledge: WebsiteKnowledge; onClose: () => void }) {
  const canonicalSections: Array<[WebsiteKnowledgeFact["category"], WebsiteKnowledgeFact[]]> = useMemo(() => groupWebsiteKnowledgeFacts(knowledge.knowledge), [knowledge.knowledge]);
  const modal = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Imported website knowledge" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#000000] shadow-[0_30px_120px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-7">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Website knowledge</p><h2 className="mt-2 text-2xl font-semibold text-white">Imported source details</h2><p className="mt-2 text-sm text-slate-400">This source is preserved separately from the information you enter manually.</p></div>
          <button type="button" onClick={onClose} aria-label="Close imported website knowledge" className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-amber-300/30 hover:text-white">×</button>
        </div>
        <div className="max-h-[calc(92vh-130px)] overflow-y-auto p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-3"><Metric label="Pages" value={String(knowledge.pages.length)} /><Metric label="Warnings" value={String(knowledge.warnings.length)} /><Metric label="Imported" value={new Date(knowledge.importedAt).toLocaleString()} /></div>
          <section className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resolved website</p><p className="mt-2 break-all text-sm text-slate-200">{knowledge.resolvedUrl}</p></section>
          {canonicalSections.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {canonicalSections.map(([category, facts]) => <section key={category} className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{WEBSITE_KNOWLEDGE_SECTION_LABELS[category]}</p><div className="mt-3 space-y-3">{facts.map((fact, index) => <article key={`${category}-${fact.title}-${index}`}><p className="text-sm font-semibold text-white">{fact.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-400">{fact.value}</p></article>)}</div></section>)}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2"><LegacyKnowledgeSection title="Products & Services" value={knowledge.productsServices} /><LegacyKnowledgeSection title="Ideal Customers" value={knowledge.idealCustomers} /><LegacyKnowledgeSection title="Additional Knowledge" value={knowledge.additionalKnowledge} /></div>
          )}
          {knowledge.warnings.length ? <section className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Warnings</p><ul className="mt-3 space-y-2 text-sm text-slate-400">{knowledge.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></section> : null}
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(modal, document.body);
}

function LegacyKnowledgeSection({ title, value }: { title: string; value: string }) {
  if (!value) return null;
  return <section className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{title}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{value}</p></section>;
}

function groupWebsiteKnowledgeFacts(knowledge?: StructuredWebsiteKnowledge): Array<[WebsiteKnowledgeFact["category"], WebsiteKnowledgeFact[]]> {
  if (!knowledge?.facts?.length) return [];
  const grouped = new Map<WebsiteKnowledgeFact["category"], WebsiteKnowledgeFact[]>();
  for (const fact of knowledge.facts) {
    const current = grouped.get(fact.category) ?? [];
    current.push(fact);
    grouped.set(fact.category, current);
  }
  return WEBSITE_KNOWLEDGE_SECTION_ORDER.flatMap((category) => {
    const facts = grouped.get(category);
    return facts?.length ? [[category, facts] as [WebsiteKnowledgeFact["category"], WebsiteKnowledgeFact[]]] : [];
  });
}
