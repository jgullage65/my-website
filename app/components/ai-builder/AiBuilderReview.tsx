"use client";

import { useMemo, useState } from "react";
import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
  BusinessContextStatus,
  GeneratedFaqEntry,
} from "@/app/lib/ai-engine/contracts";

type Props = {
  session: AiBuilderSession;
  onSessionChange: (session: AiBuilderSession) => void;
  onBack: () => void;
  onLaunchChat: () => void;
};

const CATEGORY_LABELS: Record<BusinessContextCategory, string> = {
  business_profile: "Business Profile",
  audience: "Audience",
  service: "Services",
  pricing: "Pricing",
  policy: "Policies",
  process: "Processes",
  differentiator: "Differentiators",
  faq: "FAQ Knowledge",
  behavior_rule: "Assistant Rules",
  prohibited_claim: "Prohibited Claims",
};

const primaryButtonClassName =
  "rounded-2xl border border-amber-200/50 bg-amber-300 px-5 py-3 text-sm font-bold text-[#101827] shadow-[0_14px_34px_rgba(245,158,11,0.18)] transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0";

const secondaryButtonClassName =
  "rounded-2xl border border-white/15 bg-white/[0.035] px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-300/30 hover:bg-amber-300/[0.07]";

function calculateCounts(entries: BusinessContextEntry[]): AiBuilderSession["contextCounts"] {
  const byCategory: AiBuilderSession["contextCounts"]["byCategory"] = {};
  entries.forEach((entry) => {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  });

  return {
    total: entries.length,
    approved: entries.filter(
      (entry) => entry.status === "approved" || entry.status === "corrected",
    ).length,
    proposed: entries.filter((entry) => entry.status === "proposed").length,
    archived: entries.filter((entry) => entry.status === "archived").length,
    byCategory,
  };
}

export default function AiBuilderReview({
  session,
  onSessionChange,
  onBack,
  onLaunchChat,
}: Props) {
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<BusinessContextCategory, BusinessContextEntry[]>();
    session.contextEntries.forEach((entry) => {
      const current = map.get(entry.category) ?? [];
      map.set(entry.category, current.concat(entry));
    });
    return Array.from(map.entries());
  }, [session.contextEntries]);

  const updateSession = (updates: Partial<AiBuilderSession>) => {
    onSessionChange({
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateEntry = (id: string, updates: Partial<BusinessContextEntry>) => {
    const contextEntries = session.contextEntries.map((entry) =>
      entry.id === id
        ? { ...entry, ...updates, updatedAt: new Date().toISOString() }
        : entry,
    );

    updateSession({
      status: "review_required",
      contextEntries,
      contextCounts: calculateCounts(contextEntries),
    });
  };

  const updateFaq = (id: string, updates: Partial<GeneratedFaqEntry>) => {
    updateSession({
      status: "review_required",
      faqEntries: session.faqEntries.map((faq) =>
        faq.id === id
          ? { ...faq, ...updates, updatedAt: new Date().toISOString() }
          : faq,
      ),
    });
  };

  const approveAll = () => {
    const now = new Date().toISOString();
    const contextEntries = session.contextEntries.map((entry) =>
      entry.status === "archived"
        ? entry
        : {
            ...entry,
            status:
              entry.status === "corrected"
                ? ("corrected" as const)
                : ("approved" as const),
            updatedAt: now,
          },
    );
    const faqEntries = session.faqEntries.map((faq) =>
      faq.status === "archived"
        ? faq
        : {
            ...faq,
            status:
              faq.status === "corrected"
                ? ("corrected" as const)
                : ("approved" as const),
            updatedAt: now,
          },
    );

    updateSession({
      status: "ready",
      contextEntries,
      faqEntries,
      contextCounts: calculateCounts(contextEntries),
    });
  };

  const canLaunchChat = session.status === "ready" && session.contextCounts.approved > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#030713] px-5 py-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-x-0 top-[-8rem] mx-auto h-56 max-w-3xl rounded-full bg-amber-400/10 blur-[90px]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 sm:text-sm">
            Your AI is ready
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Review what your AI learned.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Approve, correct, or remove anything before it becomes trusted business knowledge.
          </p>

          <div className="mx-auto mt-7 flex max-w-3xl flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={onBack} className={secondaryButtonClassName}>
              Back to results
            </button>
            <button type="button" onClick={approveAll} className={primaryButtonClassName}>
              Approve all knowledge
            </button>
            <button
              type="button"
              onClick={onLaunchChat}
              disabled={!canLaunchChat}
              className={primaryButtonClassName}
            >
              Test live assistant
            </button>
          </div>

          {!canLaunchChat ? (
            <p className="mt-4 text-xs text-slate-500">
              Approve the business knowledge before opening the live assistant.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={session.contextCounts.total} />
        <Stat label="Approved" value={session.contextCounts.approved} />
        <Stat label="Proposed" value={session.contextCounts.proposed} />
        <Stat label="Removed" value={session.contextCounts.archived} />
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Business knowledge"
          title="Review every important business fact."
          description="Each item stays tied to its source and can be approved, corrected, or removed."
        />

        {grouped.map(([category, categoryEntries]) => (
          <section
            key={category}
            className="rounded-[28px] border border-white/10 bg-[#030713] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                  Knowledge group
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {CATEGORY_LABELS[category]}
                </h2>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-sm font-bold text-amber-300">
                {categoryEntries.length}
              </span>
            </div>

            <div className="space-y-4">
              {categoryEntries.map((entry) => {
                const editing = editingEntry === entry.id;
                return (
                  <article
                    key={entry.id}
                    className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4 sm:p-5"
                  >
                    {editing ? (
                      <div className="space-y-3">
                        <input
                          value={entry.title}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              title: event.target.value,
                              status: "corrected",
                              metadata: { ...entry.metadata, userEdited: true },
                            })
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-white outline-none focus:border-amber-300/50"
                        />
                        <textarea
                          rows={4}
                          value={entry.content}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              content: event.target.value,
                              status: "corrected",
                              metadata: { ...entry.metadata, userEdited: true },
                            })
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-white outline-none focus:border-amber-300/50"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{entry.title}</h3>
                          <StatusPill status={entry.status} />
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{entry.content}</p>
                      </>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateEntry(entry.id, {
                            status: entry.status === "approved" ? "proposed" : "approved",
                          })
                        }
                        className="rounded-xl border border-amber-300/35 bg-amber-300/[0.09] px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-300/[0.14]"
                      >
                        {entry.status === "approved" ? "Unapprove" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEntry(editing ? null : entry.id)}
                        className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/[0.06]"
                      >
                        {editing ? "Done" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateEntry(entry.id, { status: "archived" })}
                        className="rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-2.5 text-xs font-bold text-red-300 transition hover:bg-red-400/[0.11]"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Generated Q&A"
          title="Questions your AI is ready to answer."
          description="Review the generated answers before they become part of the live assistant."
        />

        <div className="space-y-4">
          {session.faqEntries.map((faq) => {
            const editing = editingFaq === faq.id;
            return (
              <article
                key={faq.id}
                className="rounded-[24px] border border-white/10 bg-[#030713] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.18)] sm:p-6"
              >
                {editing ? (
                  <div className="space-y-3">
                    <input
                      value={faq.question}
                      onChange={(event) =>
                        updateFaq(faq.id, {
                          question: event.target.value,
                          status: "corrected",
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-white outline-none focus:border-amber-300/50"
                    />
                    <textarea
                      rows={4}
                      value={faq.answer}
                      onChange={(event) =>
                        updateFaq(faq.id, {
                          answer: event.target.value,
                          status: "corrected",
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-white outline-none focus:border-amber-300/50"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{faq.question}</h3>
                      <StatusPill status={faq.status} />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{faq.answer}</p>
                  </>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateFaq(faq.id, {
                        status: faq.status === "approved" ? "proposed" : "approved",
                      })
                    }
                    className="rounded-xl border border-amber-300/35 bg-amber-300/[0.09] px-4 py-2.5 text-xs font-bold text-amber-300"
                  >
                    {faq.status === "approved" ? "Unapprove" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFaq(editing ? null : faq.id)}
                    className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-white"
                  >
                    {editing ? "Done" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFaq(faq.id, { status: "archived" })}
                    className="rounded-xl border border-red-400/25 bg-red-400/[0.07] px-4 py-2.5 text-xs font-bold text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
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
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: BusinessContextStatus }) {
  const label =
    status === "corrected"
      ? "Corrected"
      : status === "approved"
        ? "Approved"
        : status === "archived"
          ? "Removed"
          : "Proposed";

  return (
    <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#030713] px-3 py-4 text-center shadow-[0_14px_44px_rgba(0,0,0,0.18)] sm:px-5">
      <div className="text-2xl font-semibold text-amber-300 sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">{label}</div>
    </div>
  );
}
