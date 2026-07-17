"use client";

import { useState } from "react";
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
  "w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-amber-500";

export default function AiBuilderForm({ value, onChange, onBuild }: Props) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const updateProfile = (
    key: "businessName" | "industry" | "website" | "tone",
    nextValue: string,
  ) => {
    onChange({ ...value, [key]: nextValue });
  };

  const updateUserKnowledge = (
    key: keyof UserKnowledge,
    nextValue: string,
  ) => {
    onChange({
      ...value,
      userKnowledge: {
        ...value.userKnowledge,
        [key]: nextValue,
      },
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
        `Imported website knowledge from ${pageCount} page${pageCount === 1 ? "" : "s"}. Your manual answers remain separate and take priority.`,
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
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-400">
          Business intake
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Teach your AI how your business works.
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Import public website knowledge, then add or correct information manually.
          Manual answers always take priority.
        </p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-5 md:grid-cols-2">
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
              onChange={(event) => updateProfile("industry", event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Website"
          helper="Optional. Import public business information without overwriting your manual knowledge."
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="url"
              className={inputClassName}
              placeholder="https://example.com"
              value={value.website}
              onChange={(event) => updateProfile("website", event.target.value)}
            />
            <button
              type="button"
              disabled={!value.website.trim() || importing}
              onClick={importWebsite}
              className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-5 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing
                ? "Importing..."
                : value.websiteKnowledge
                  ? "Re-import Website"
                  : "Import Website"}
            </button>
          </div>
          {importError ? (
            <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {importError}
            </span>
          ) : null}
          {importMessage ? (
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {importMessage}
            </span>
          ) : null}
          {value.websiteKnowledge ? (
            <span className="text-xs leading-5 text-neutral-500">
              Website knowledge loaded from {value.websiteKnowledge.pages.length} page
              {value.websiteKnowledge.pages.length === 1 ? "" : "s"}. Re-importing
              replaces only the website knowledge.
            </span>
          ) : null}
        </Field>

        <Field
          label="Products / services"
          helper="Add corrections, private details, or anything the website does not explain."
          required
        >
          <textarea
            rows={6}
            className={`${inputClassName} resize-y`}
            placeholder={
              value.websiteKnowledge?.productsServices
                ? "Website knowledge is already loaded. Add corrections or private details here."
                : "Describe your services, packages, deliverables, pricing structure, and what each option is for."
            }
            value={value.userKnowledge.productsServices}
            onChange={(event) =>
              updateUserKnowledge("productsServices", event.target.value)
            }
          />
        </Field>

        <Field
          label="Ideal customers"
          helper="Add corrections or customer details that should override the public website."
          required
        >
          <textarea
            rows={5}
            className={`${inputClassName} resize-y`}
            placeholder={
              value.websiteKnowledge?.idealCustomers
                ? "Website knowledge is already loaded. Add corrections or more specific customer details here."
                : "Describe your best-fit customers, industries, company sizes, locations, needs, and common goals."
            }
            value={value.userKnowledge.idealCustomers}
            onChange={(event) =>
              updateUserKnowledge("idealCustomers", event.target.value)
            }
          />
        </Field>

        <Field label="Communication style">
          <select
            className={inputClassName}
            value={value.tone}
            onChange={(event) => updateProfile("tone", event.target.value)}
          >
            <option>Professional</option>
            <option>Friendly</option>
            <option>Consultative</option>
            <option>Direct</option>
            <option>Warm</option>
          </select>
        </Field>

        <Field
          label="Additional business knowledge"
          helper="Add private policies, SOPs, objections, sales processes, guarantees, or corrections."
        >
          <textarea
            rows={10}
            className={`${inputClassName} resize-y`}
            placeholder="Share private pricing, policies, FAQs, guarantees, processes, differentiators, common objections, and anything else your AI should know."
            value={value.userKnowledge.additionalKnowledge}
            onChange={(event) =>
              updateUserKnowledge("additionalKnowledge", event.target.value)
            }
          />
        </Field>

        <button
          type="button"
          disabled={!valid || importing}
          onClick={onBuild}
          className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Build My AI
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  required = false,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-white">
        {label}
        {required ? <span className="text-amber-400"> *</span> : null}
      </span>
      {helper ? (
        <span className="text-xs leading-5 text-neutral-500">{helper}</span>
      ) : null}
      {children}
    </label>
  );
}
