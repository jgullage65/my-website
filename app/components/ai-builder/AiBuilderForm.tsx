"use client";

import Link from "next/link";
import AiBuilderAuthCta from "./AiBuilderAuthCta";
import { useEffect, useState, type ReactNode } from "react";
import type {
  BuilderState,
  UserKnowledge,
  WebsiteKnowledge,
} from "./AiBuilderClient";
import type {
  StructuredWebsiteKnowledge,
  WebsiteKnowledgePage,
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
  | ({ type: "result" } & WebsiteImportPayload)
  | { type: "error"; error?: { message?: string }; crawlAttemptId?: string };

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3.5 text-center text-[15px] text-white shadow-inner shadow-black/30 outline-none transition placeholder:text-center placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-4 focus:ring-amber-400/5";

const bottomCardClassName =
  "relative flex min-h-[238px] flex-col items-center justify-center overflow-hidden rounded-[28px] border bg-[#030713] px-6 py-7 text-center sm:px-8";

export default function AiBuilderForm({ value, onChange, onBuild }: Props) {
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showWebsiteKnowledge, setShowWebsiteKnowledge] = useState(false);

  useEffect(() => {
    if (!importing) return;

    const timer = window.setInterval(() => {
      setImportProgress((current) => {
        if (current >= 96) return current;
        if (current < 20) return current + 2;
        if (current < 50) return current + 1;
        return current + 0.5;
      });
    }, 700);

    return () => window.clearInterval(timer);
  }, [importing]);

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
          if (event.type === "progress") {
            setImportProgress((current) => Math.max(current, event.percent));
          } else if (event.type === "error") {
            if (event.crawlAttemptId && !value.crawlAttemptIds.includes(event.crawlAttemptId)) onChange({ ...value, crawlAttemptIds: [...value.crawlAttemptIds, event.crawlAttemptId] });
            throw new Error(event.error?.message || "The website could not be imported.");
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
        crawlAttemptIds: payload.crawlAttemptId && !value.crawlAttemptIds.includes(payload.crawlAttemptId) ? [...value.crawlAttemptIds, payload.crawlAttemptId] : value.crawlAttemptIds,
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

  const hasProductsServices = Boolean(
    value.userKnowledge.productsServices.trim() ||
      value.websiteKnowledge?.productsServices.trim(),
  );
  const hasIdealCustomers = Boolean(
    value.userKnowledge.idealCustomers.trim() ||
      value.websiteKnowledge?.idealCustomers.trim(),
  );
  const valid = Boolean(
    value.businessName.trim() &&
      value.industry.trim() &&
      hasProductsServices &&
      hasIdealCustomers,
  );

  return (
    <div className="space-y-20 pb-8 sm:space-y-24">
      <div className="relative mx-auto max-w-5xl rounded-[30px] border border-white/[0.09] bg-[#030713] px-4 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:py-10">
        <AiBuilderAuthCta />
        <section className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
          AI Builder
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
          Build Your <span className="text-amber-300">Business AI</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
          Train an AI assistant that truly understands your business. Import your
          website, teach it what only you know, and launch in minutes.
        </p>
        <Link href="/ai-builder" className="mt-8 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">← All Projects</Link>
        </section>

        <section className="mt-10">
          <article className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-amber-300/25 bg-[#030713] px-5 py-7 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35),0_0_45px_rgba(245,158,11,0.06)] sm:px-8 sm:py-9">
          <div className="absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <span
              className={`absolute right-0 top-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                value.websiteKnowledge
                  ? "cta-raised border-amber-300/15 bg-[#030713] text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-400"
              }`}
            >
              {value.websiteKnowledge ? "Active" : "Optional"}
            </span>

            <div className="mx-auto flex w-fit flex-col items-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-xl shadow-[0_0_24px_rgba(245,158,11,0.1)]">
                🌐
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                Website
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-white">
                {value.websiteKnowledge ? "Connected" : "Connect your website"}
              </h3>
            </div>

            {value.websiteKnowledge ? (
              <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <Metric
                  label="Pages imported"
                  value={String(value.websiteKnowledge.pages.length)}
                />
                <Metric
                  label="Warnings"
                  value={String(value.websiteKnowledge.warnings.length)}
                />
                <Metric
                  label="Last updated"
                  value={new Date(
                    value.websiteKnowledge.importedAt,
                  ).toLocaleDateString()}
                />
              </div>
            ) : (
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400">
                We will safely crawl your public pages and organize the useful
                business information into a read-only knowledge source.
              </p>
            )}

            <div className="mx-auto mt-6 grid max-w-xl gap-3">
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
                  ? `Importing… ${importProgress}%`
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
      </div>

      <section className="mx-auto max-w-5xl rounded-[30px] border border-white/[0.09] bg-[#030713] px-4 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:py-10">
        <SectionHeading
          eyebrow="Your expertise"
          title={
            <>
              Tell your AI{" "}
              <span className="text-amber-300">what only you know.</span>
            </>
          }
          description="Add private context, corrections, and the details that make your business different. Your answers always win when sources conflict."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <KnowledgeCard
            icon="◈"
            title="Business profile"
            description="The identity your assistant represents."
          >
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

          <KnowledgeCard
            icon="✦"
            title="Products & Services"
            description="What you sell, how it works, and why customers choose it."
          >
            <textarea
              rows={9}
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

          <KnowledgeCard
            icon="◎"
            title="Ideal Customers"
            description="Who your AI should recognize as the best fit."
          >
            <textarea
              rows={8}
              className={`${inputClassName} resize-y`}
              placeholder={
                value.websiteKnowledge?.idealCustomers
                  ? "Add more specific customer details or correct anything the website got wrong."
                  : "Describe your best-fit customers, industries, company sizes, locations, needs, and common goals."
              }
              value={value.userKnowledge.idealCustomers}
              onChange={(event) =>
                updateUserKnowledge("idealCustomers", event.target.value)
              }
            />
          </KnowledgeCard>

          <KnowledgeCard
            icon="☰"
            title="Additional Business Knowledge"
            description="Private policies, processes, objections, FAQs, and operating knowledge."
          >
            <textarea
              rows={8}
              className={`${inputClassName} resize-y`}
              placeholder="Share private pricing, policies, SOPs, guarantees, sales processes, differentiators, common objections, and anything else your AI should know."
              value={value.userKnowledge.additionalKnowledge}
              onChange={(event) =>
                updateUserKnowledge("additionalKnowledge", event.target.value)
              }
            />
          </KnowledgeCard>
        </div>

        <div className="mx-auto mt-5 grid max-w-4xl gap-5 lg:grid-cols-2">
          <section className={`${bottomCardClassName} border-amber-300/25`}>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              Communication style
            </p>
            <h3 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
              How should your AI sound?
            </h3>
            <select
              className={`${inputClassName} mx-auto mt-5 block max-w-sm`}
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

          <section
            className={`${bottomCardClassName} border-amber-300/25 shadow-[0_24px_80px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)]`}
          >
            <div className="absolute inset-x-0 bottom-[-7rem] mx-auto h-40 max-w-xl rounded-full bg-amber-400/12 blur-[80px]" />
            <div className="relative flex flex-col items-center justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                Final step
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
                Everything look good?
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                Review your setup, then build your AI.
              </p>
              <button
                type="button"
                disabled={!valid || importing}
                onClick={onBuild}
                className="mt-5 min-w-52 rounded-2xl border border-amber-300/15 bg-[#081226] px-6 py-3.5 font-bold text-white shadow-[0_16px_40px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                Build My AI
              </button>
              {!valid ? (
                <p className="mt-3 max-w-sm text-xs leading-5 text-slate-500">
                  Add your business name, industry, products or services, and ideal
                  customers to continue.
                </p>
              ) : (
                <p className="mt-3 text-xs text-emerald-300/80">Ready to build.</p>
              )}
            </div>
          </section>
        </div>
      </section>

      {showWebsiteKnowledge && value.websiteKnowledge ? (
        <WebsiteKnowledgeModal
          knowledge={value.websiteKnowledge}
          onClose={() => setShowWebsiteKnowledge(false)}
        />
      ) : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-black/10 p-3 ${className}`}
    >
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function KnowledgeCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[28px] border border-amber-300/25 bg-[#030713] p-6 text-center shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] font-semibold text-amber-300">
            {icon}
          </div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="mt-6 grid gap-5">{children}</div>
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

function Status({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`mx-auto mt-4 max-w-3xl rounded-xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "cta-raised border-amber-300/15 bg-[#030713] text-white"
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
  return (
    <div
      className="fixed inset-0 z-[240] flex h-[100dvh] w-screen items-stretch justify-center bg-[#030713] p-0 sm:h-auto sm:w-auto sm:items-center sm:bg-transparent sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="h-[100dvh] w-full overflow-y-auto border-0 bg-[#030713] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-[30px] sm:border sm:border-white/10"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-[#030713]/95 px-16 py-5 text-center backdrop-blur sm:px-20">
          <div className="mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              Website knowledge
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Imported business information
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close website knowledge"
            className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-amber-300/15 bg-[#081226] text-xl text-slate-300 hover:border-amber-300/30 hover:bg-[#0b1830] sm:right-6"
          >
            ×
          </button>
        </div>
        <div className="grid gap-5 p-5 sm:p-8">
          <ReadOnlyBlock
            title="Company Summary"
            content={[
              knowledge.businessName && `Business: ${knowledge.businessName}`,
              knowledge.industry && `Industry: ${knowledge.industry}`,
              knowledge.website && `Website: ${knowledge.website}`,
            ]
              .filter(Boolean)
              .join("\n")}
          />
          <ReadOnlyBlock
            title="Products & Services"
            content={knowledge.productsServices}
          />
          <ReadOnlyBlock
            title="Ideal Customers"
            content={knowledge.idealCustomers}
          />
          <ReadOnlyBlock
            title="Additional Business Knowledge"
            content={knowledge.additionalKnowledge}
          />
          <p className="text-center text-xs leading-5 text-slate-500">
            Website knowledge is read-only. Re-import the website to refresh it.
            Your manual expertise is never overwritten.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyBlock({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <h3 className="text-center text-sm font-semibold text-amber-300">{title}</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
        {content || "No information found."}
      </p>
    </section>
  );
}
