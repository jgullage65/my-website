"use client";

import { useState, type ReactNode } from "react";
import type {
  BuilderState,
  UserKnowledge,
  WebsiteKnowledge,
} from "./AiBuilderClient";

type Props = {
  value: BuilderState;
  onChange: (value: BuilderState) => void;
  onBuild: () => void;
};

type WebsiteImportPayload = {
  ok?: boolean;
  import?: {
    businessName?: string;
    industry?: string;
    website?: string;
    productsServices?: string;
    idealCustomers?: string;
    additionalKnowledge?: string;
  };
  pages?: Array<{ url: string; title: string; pageType: string }>;
  warnings?: string[];
  error?: { message?: string };
};

const inputClassName =
  "w-full rounded-2xl border border-white/10 bg-[#071321]/80 px-4 py-3.5 text-[15px] text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-slate-500 focus:border-amber-400/60 focus:ring-4 focus:ring-amber-400/5";

export default function AiBuilderForm({ value, onChange, onBuild }: Props) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showWebsiteKnowledge, setShowWebsiteKnowledge] = useState(false);

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
    setImportError(null);
    setImportMessage(null);

    try {
      const response = await fetch("/api/ai-builder/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website }),
      });
      const payload = (await response.json()) as WebsiteImportPayload;

      if (!response.ok || !payload.ok || !payload.import) {
        throw new Error(
          payload.error?.message || "The website could not be imported.",
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
        pages: payload.pages ?? [],
        warnings: payload.warnings ?? [],
        importedAt: new Date().toISOString(),
      };

      onChange({
        ...value,
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
      <section className="mx-auto max-w-4xl pt-8 text-center sm:pt-12">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.9)]" />
          AI Builder
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
          Build Your <span className="text-amber-300">Business AI</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
          Train an AI assistant that truly understands your business. Import your
          website, teach it what only you know, and launch in minutes.
        </p>
        <div className="mx-auto mt-10 grid max-w-2xl gap-3 text-sm text-slate-400 sm:grid-cols-3">
          <HeroPoint number="01" label="Connect knowledge" />
          <HeroPoint number="02" label="Add your expertise" />
          <HeroPoint number="03" label="Build your AI" />
        </div>
      </section>

      <section>
        <article className="relative overflow-hidden rounded-[28px] border border-amber-300/25 bg-[#030713] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.35),0_0_45px_rgba(245,158,11,0.06)] sm:p-8">
          <div className="absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-2xl shadow-[0_0_24px_rgba(245,158,11,0.1)]">
                  🌐
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Website
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">
                    {value.websiteKnowledge ? "Connected" : "Connect your website"}
                  </h3>
                </div>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  value.websiteKnowledge
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/[0.04] text-slate-400"
                }`}
              >
                {value.websiteKnowledge ? "Active" : "Optional"}
              </span>
            </div>

            {value.websiteKnowledge ? (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  className="col-span-2 sm:col-span-1"
                />
              </div>
            ) : (
              <p className="mt-6 max-w-xl text-sm leading-6 text-slate-400">
                We will safely crawl your public pages and organize the useful
                business information into a read-only knowledge source.
              </p>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
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
                className="rounded-2xl border border-amber-300/35 bg-amber-300 px-5 py-3.5 font-semibold text-[#101827] shadow-[0_12px_30px_rgba(245,158,11,0.18)] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {importing
                  ? "Importing..."
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
                className="mt-5 text-sm font-semibold text-amber-300 transition hover:text-amber-200"
              >
                View imported knowledge →
              </button>
            ) : null}
          </div>
        </article>
      </section>

      <section>
        <SectionHeading
          eyebrow="Your expertise"
          title="Tell your AI what only you know."
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

        <div className="mx-auto mt-5 max-w-2xl rounded-[28px] border border-white/10 bg-[#030713] px-6 py-7 text-center sm:px-8 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Communication style
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            How should your AI sound?
          </h3>
          <select
            className={`${inputClassName} mx-auto mt-5 max-w-xl`}
            value={value.tone}
            onChange={(event) => updateProfile("tone", event.target.value)}
          >
            <option>Professional</option>
            <option>Friendly</option>
            <option>Consultative</option>
            <option>Direct</option>
            <option>Warm</option>
          </select>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[34px] border border-amber-300/25 bg-[#030713] px-6 py-14 text-center shadow-[0_30px_100px_rgba(0,0,0,0.42),0_0_70px_rgba(245,158,11,0.07)] sm:px-10 sm:py-20">
        <div className="absolute inset-x-0 bottom-[-8rem] mx-auto h-52 max-w-3xl rounded-full bg-amber-400/15 blur-[90px]" />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-300">
            Final step
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
            Everything looks good?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            We will combine your expertise with your imported website knowledge,
            organize it into a reviewable knowledge pack, and prepare your AI.
          </p>
          <button
            type="button"
            disabled={!valid || importing}
            onClick={onBuild}
            className="mt-9 min-w-64 rounded-2xl border border-amber-200/50 bg-amber-300 px-8 py-4 text-lg font-bold text-[#101827] shadow-[0_18px_50px_rgba(245,158,11,0.22)] transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            Build My AI
          </button>
          {!valid ? (
            <p className="mt-4 text-sm text-slate-500">
              Add your business name, industry, products or services, and ideal
              customers to continue.
            </p>
          ) : (
            <p className="mt-4 text-sm text-emerald-300/80">Ready to build.</p>
          )}
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

function HeroPoint({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2.5">
      <span className="text-xs font-bold text-amber-300">{number}</span>
      <span>{label}</span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
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
      className={`rounded-2xl border border-white/[0.07] bg-black/10 p-4 ${className}`}
    >
      <p className="text-xl font-semibold text-white">{value}</p>
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
    <article className="rounded-[28px] border border-white/10 bg-[#030713] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] font-semibold text-amber-300">
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
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
    <label className="grid gap-2">
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
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200"
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#02060d]/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#030713] shadow-2xl sm:rounded-[30px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.07] bg-[#030713]/95 px-5 py-5 backdrop-blur sm:px-8">
          <div>
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
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-slate-300 hover:bg-white/[0.08]"
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
      <h3 className="text-sm font-semibold text-amber-300">{title}</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
        {content || "No information found."}
      </p>
    </section>
  );
}
