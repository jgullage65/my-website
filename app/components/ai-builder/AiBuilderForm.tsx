"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import AiBuilderAuthCta from "./AiBuilderAuthCta";
import type {
  BuilderState,
  UserKnowledge,
  WebsiteKnowledge,
} from "./AiBuilderClient";
import type {
  StructuredWebsiteKnowledge,
  WebsiteKnowledgeFact,
  WebsiteKnowledgePage,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import {
  WEBSITE_KNOWLEDGE_SECTION_LABELS,
  WEBSITE_KNOWLEDGE_SECTION_ORDER,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";

type Props = {
  value: BuilderState;
  onChange: (value: BuilderState) => void;
  onBuild: () => void;
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
  error?: { message?: string };
};

type WebsiteImportEvent =
  | { type: "progress"; percent: number }
  | { type: "crawl_progress"; pagesCrawled: number; pagesDiscovered: number }
  | { type: "crawl_complete"; pagesCrawled: number; pagesDiscovered: number }
  | ({ type: "result" } & WebsiteImportPayload)
  | { type: "error"; error?: { message?: string }; crawlAttemptId?: string };

const inputClassName =
  "w-full rounded-xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-sm text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-center placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-4 focus:ring-amber-400/5";

const cardClassName =
  "rounded-2xl border border-amber-300/20 bg-[#050a16]/88 p-5 shadow-[0_14px_42px_rgba(0,0,0,0.2)]";

export default function AiBuilderForm({ value, onChange, onBuild }: Props) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [crawlPages, setCrawlPages] = useState(0);
  const [importStage, setImportStage] = useState<"crawl" | "processing">("crawl");
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showWebsiteKnowledge, setShowWebsiteKnowledge] = useState(false);

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

  const updateProfile = (
    key: "businessName" | "industry" | "website" | "tone",
    nextValue: string,
  ) => onChange({ ...value, [key]: nextValue });

  const updateUserKnowledge = (
    key: keyof UserKnowledge,
    nextValue: string,
  ) => {
    onChange({
      ...value,
      userKnowledge: { ...value.userKnowledge, [key]: nextValue },
    });
  };

  const importWebsite = async () => {
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
        body: JSON.stringify({ website }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json()) as WebsiteImportPayload;
        throw new Error(payload.error?.message || "The website could not be imported.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let payload: WebsiteImportPayload | null = null;

      while (true) {
        const { done, value: chunk } = await reader.read();
        buffer += decoder.decode(chunk, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as WebsiteImportEvent;
          if (event.type === "crawl_progress") {
            setCrawlPages(event.pagesCrawled);
          } else if (event.type === "crawl_complete") {
            setCrawlPages(event.pagesCrawled);
            setImportStage("processing");
            setImportProgress(70);
          } else if (event.type === "progress") {
            setImportProgress((current) => Math.max(current, event.percent));
          } else if (event.type === "error") {
            if (
              event.crawlAttemptId &&
              !value.crawlAttemptIds.includes(event.crawlAttemptId)
            ) {
              onChange({
                ...value,
                crawlAttemptIds: [
                  ...value.crawlAttemptIds,
                  event.crawlAttemptId,
                ],
              });
            }
            throw new Error(
              event.error?.message || "The website could not be imported.",
            );
          } else if (event.type === "result") {
            payload = event;
          }
        }

        if (done) break;
      }

      if (!payload?.ok || !payload.import) {
        throw new Error(
          payload?.error?.message || "The website could not be imported.",
        );
      }

      const imported = payload.import;
      const websiteKnowledge: WebsiteKnowledge = {
        businessName: imported.businessName?.trim() || "",
        industry: imported.industry?.trim() || "",
        website: imported.website?.trim() || website,
        requestedUrl: imported.requestedUrl?.trim() || website,
        resolvedUrl:
          imported.resolvedUrl?.trim() || imported.website?.trim() || website,
        productsServices: imported.productsServices?.trim() || "",
        idealCustomers: imported.idealCustomers?.trim() || "",
        additionalKnowledge: imported.additionalKnowledge?.trim() || "",
        knowledge: payload.knowledge,
        pages: payload.pages ?? [],
        warnings: payload.warnings ?? [],
        importedAt: new Date().toISOString(),
        crawlAttemptId: payload.crawlAttemptId,
      };

      onChange({
        ...value,
        crawlAttemptIds:
          payload.crawlAttemptId &&
          !value.crawlAttemptIds.includes(payload.crawlAttemptId)
            ? [...value.crawlAttemptIds, payload.crawlAttemptId]
            : value.crawlAttemptIds,
        businessName: value.businessName.trim()
          ? value.businessName
          : websiteKnowledge.businessName,
        industry: value.industry.trim()
          ? value.industry
          : websiteKnowledge.industry,
        website: websiteKnowledge.website,
        websiteKnowledge,
      });

      const pageCount = websiteKnowledge.pages.length;
      setImportMessage(
        `Imported ${pageCount} page${pageCount === 1 ? "" : "s"}. Your expertise remains separate and always takes priority.`,
      );
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "The website could not be imported.",
      );
    } finally {
      setImporting(false);
    }
  };

  const valid = Boolean(
    value.businessName.trim() &&
      value.industry.trim() &&
      (value.userKnowledge.productsServices.trim() ||
        value.websiteKnowledge?.productsServices.trim()) &&
      (value.userKnowledge.idealCustomers.trim() ||
        value.websiteKnowledge?.idealCustomers.trim()),
  );

  return (
    <div className="w-full pb-10 min-[1200px]:mx-auto min-[1200px]:max-w-[1500px] min-[1200px]:px-8">
      <div className="relative bg-[#030713] px-4 py-8 sm:px-6 sm:py-10 min-[1200px]:rounded-[28px] min-[1200px]:border min-[1200px]:border-white/[0.09] min-[1200px]:p-8 min-[1200px]:shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
        <AiBuilderAuthCta />

        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
            AI Builder
          </p>
          <Link
            href="/ai-builder"
            className="mt-8 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]"
          >
            ← All Projects
          </Link>
        </header>

        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <section className="xl:sticky xl:top-4">
            <article className={`${cardClassName} relative overflow-hidden text-center`}>
              <div className="absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="relative">
                <span
                  className={`absolute right-0 top-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                    value.websiteKnowledge
                      ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
                      : "border-white/10 bg-white/[0.04] text-slate-400"
                  }`}
                >
                  {value.websiteKnowledge ? "Active" : "Optional"}
                </span>

                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-xl">
                  🌐
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Website knowledge
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {value.websiteKnowledge ? "Website connected" : "Connect your website"}
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
                  We safely crawl public pages and organize the useful information into a read-only source.
                </p>

                {value.websiteKnowledge ? (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <Metric
                      label="Pages"
                      value={String(value.websiteKnowledge.pages.length)}
                    />
                    <Metric
                      label="Warnings"
                      value={String(value.websiteKnowledge.warnings.length)}
                    />
                    <Metric
                      label="Updated"
                      value={new Date(
                        value.websiteKnowledge.importedAt,
                      ).toLocaleDateString()}
                    />
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3">
                  <input
                    type="url"
                    className={inputClassName}
                    placeholder="https://yourbusiness.com"
                    value={value.website}
                    onChange={(event) =>
                      updateProfile("website", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    disabled={!value.website.trim() || importing}
                    onClick={importWebsite}
                    className="mx-auto inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:border-[rgba(212,175,55,0.18)] disabled:bg-[#030713] disabled:text-white disabled:shadow-none disabled:[border-width:0.5px] disabled:hover:translate-y-0 disabled:hover:border-[rgba(212,175,55,0.18)] disabled:hover:bg-[#030713]"
                  >
                    {importing
                      ? importStage === "crawl"
                        ? `${crawlPages} page${crawlPages === 1 ? "" : "s"} crawled`
                        : `Importing… ${importProgress}%`
                      : value.websiteKnowledge
                        ? "Re-import Website"
                        : "Import Website"}
                  </button>
                </div>

                {importError ? <Status tone="error">{importError}</Status> : null}
                {importMessage ? (
                  <Status tone="success">{importMessage}</Status>
                ) : null}

                {value.websiteKnowledge ? (
                  <button
                    type="button"
                    onClick={() => setShowWebsiteKnowledge(true)}
                    className="cta-raised mt-4 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0b1830]"
                  >
                    View imported knowledge →
                  </button>
                ) : null}
              </div>
            </article>
          </section>

          <section className="min-w-0 space-y-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                Your expertise
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                Add what only you know.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your answers stay separate from the website import and take priority when sources conflict.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <KnowledgeCard title="Business profile">
                <Field label="Business name" required>
                  <input
                    className={inputClassName}
                    placeholder="JG Creative Studio"
                    value={value.businessName}
                    onChange={(event) =>
                      updateProfile("businessName", event.target.value)
                    }
                  />
                </Field>
                <Field label="Industry / business type" required>
                  <input
                    className={inputClassName}
                    placeholder="Web design and AI automation agency"
                    value={value.industry}
                    onChange={(event) =>
                      updateProfile("industry", event.target.value)
                    }
                  />
                </Field>
              </KnowledgeCard>

              <KnowledgeCard title="Products & Services">
                <textarea
                  rows={6}
                  className={`${inputClassName} resize-y`}
                  placeholder={
                    value.websiteKnowledge?.productsServices
                      ? "Add private details, corrections, packages, pricing, or anything your website does not explain."
                      : "Describe your services, packages, deliverables, pricing structure, and what each option is for."
                  }
                  value={value.userKnowledge.productsServices}
                  onChange={(event) =>
                    updateUserKnowledge("productsServices", event.target.value)
                  }
                />
              </KnowledgeCard>

              <KnowledgeCard title="Ideal Customers">
                <textarea
                  rows={6}
                  className={`${inputClassName} resize-y`}
                  placeholder={
                    value.websiteKnowledge?.idealCustomers
                      ? "Add more specific customer details or correct anything the website got wrong."
                      : "Describe your best-fit customers, industries, company sizes, locations, needs, and goals."
                  }
                  value={value.userKnowledge.idealCustomers}
                  onChange={(event) =>
                    updateUserKnowledge("idealCustomers", event.target.value)
                  }
                />
              </KnowledgeCard>

              <KnowledgeCard title="Additional Business Knowledge">
                <textarea
                  rows={6}
                  className={`${inputClassName} resize-y`}
                  placeholder="Share private pricing, policies, processes, guarantees, objections, FAQs, and anything else your AI should know."
                  value={value.userKnowledge.additionalKnowledge}
                  onChange={(event) =>
                    updateUserKnowledge("additionalKnowledge", event.target.value)
                  }
                />
              </KnowledgeCard>
            </div>

            <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
              <section className={`${cardClassName} text-center`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Communication style
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  How should your AI sound?
                </h3>
                <select
                  className={`${inputClassName} mt-4`}
                  value={value.tone}
                  onChange={(event) => updateProfile("tone", event.target.value)}
                >
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Consultative</option>
                  <option>Direct</option>
                  <option>Warm</option>
                </select>
              </section>

              <section className={`${cardClassName} relative overflow-hidden text-center`}>
                <div className="absolute inset-x-0 bottom-[-7rem] mx-auto h-40 max-w-xl rounded-full bg-amber-400/12 blur-[80px]" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Final step
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    Ready to build your AI?
                  </h3>
                  <button
                    type="button"
                    disabled={!valid || importing}
                    onClick={onBuild}
                    className="mt-5 min-w-52 rounded-2xl border border-amber-300/15 bg-[#081226] px-6 py-3.5 font-bold text-white shadow-[0_16px_40px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    Build My AI
                  </button>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {valid
                      ? "Everything required is ready."
                      : "Add your business name, industry, products or services, and ideal customers to continue."}
                  </p>
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>

      {showWebsiteKnowledge && value.websiteKnowledge ? (
        <WebsiteKnowledgeModal
          knowledge={value.websiteKnowledge}
          onClose={() => setShowWebsiteKnowledge(false)}
        />
      ) : null}
    </div>
  );
}

function KnowledgeCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className={cardClassName}>
      <h3 className="text-center text-lg font-semibold text-amber-300">
        {title}
      </h3>
      <div className="mt-4 grid gap-4">{children}</div>
    </article>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-center">
      <span className="text-sm font-semibold text-slate-200">
        {label}
        {required ? <span className="text-amber-300"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3 text-center">
      <p className="text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-[0.68rem] text-slate-500">{label}</p>
    </div>
  );
}

function Status({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-auto mt-4 rounded-xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-amber-300/15 bg-amber-300/[0.06] text-white"
          : "border-red-400/20 bg-red-400/[0.07] text-red-200"
      }`}
    >
      {children}
    </div>
  );
}

function WebsiteKnowledgeModal({
  knowledge,
  onClose,
}: {
  knowledge: WebsiteKnowledge;
  onClose: () => void;
}) {
  const canonicalSections = useMemo(
    () => groupWebsiteKnowledgeFacts(knowledge.knowledge),
    [knowledge.knowledge],
  );

  const modal = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Imported website knowledge"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#030713] shadow-[0_30px_120px_rgba(0,0,0,0.7)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              Website knowledge
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Imported source details</h2>
            <p className="mt-2 text-sm text-slate-400">
              This source is preserved separately from the information you enter manually.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close imported website knowledge"
            className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-amber-300/30 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-130px)] overflow-y-auto p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Pages" value={String(knowledge.pages.length)} />
            <Metric label="Warnings" value={String(knowledge.warnings.length)} />
            <Metric label="Imported" value={new Date(knowledge.importedAt).toLocaleString()} />
          </div>

          <section className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Resolved website</p>
            <p className="mt-2 break-all text-sm text-slate-200">{knowledge.resolvedUrl}</p>
          </section>

          {canonicalSections.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {canonicalSections.map(([section, facts]) => (
                <section key={section} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    {WEBSITE_KNOWLEDGE_SECTION_LABELS[section]}
                  </p>
                  <div className="mt-3 space-y-3">
                    {facts.map((fact, index) => (
                      <article key={`${section}-${fact.label}-${index}`}>
                        <p className="text-sm font-semibold text-white">{fact.label}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-400">{fact.value}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <LegacyKnowledgeSection title="Products & Services" value={knowledge.productsServices} />
              <LegacyKnowledgeSection title="Ideal Customers" value={knowledge.idealCustomers} />
              <LegacyKnowledgeSection title="Additional Knowledge" value={knowledge.additionalKnowledge} />
            </div>
          )}

          {knowledge.warnings.length ? (
            <section className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Warnings</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {knowledge.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(modal, document.body);
}

function LegacyKnowledgeSection({ title, value }: { title: string; value: string }) {
  if (!value) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{title}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{value}</p>
    </section>
  );
}

function groupWebsiteKnowledgeFacts(knowledge?: StructuredWebsiteKnowledge) {
  if (!knowledge?.facts?.length) return [] as Array<[WebsiteKnowledgeFact["section"], WebsiteKnowledgeFact[]]>;
  const grouped = new Map<WebsiteKnowledgeFact["section"], WebsiteKnowledgeFact[]>();
  for (const fact of knowledge.facts) {
    const current = grouped.get(fact.section) ?? [];
    current.push(fact);
    grouped.set(fact.section, current);
  }
  return WEBSITE_KNOWLEDGE_SECTION_ORDER.flatMap((section) => {
    const facts = grouped.get(section);
    return facts?.length ? [[section, facts] as [WebsiteKnowledgeFact["section"], WebsiteKnowledgeFact[]]] : [];
  });
}
