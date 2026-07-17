"use client";

import { useMemo, useState } from "react";
import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
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
  "rounded-2xl border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(245,158,11,0.18)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0";

const secondaryButtonClassName =
  "rounded-2xl border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-300/30 hover:bg-[#0b1830]";

const itemActionClassName =
  "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-bold text-white transition hover:border-amber-300/30 hover:bg-[#0b1830]";

const approveActionClassName =
  "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:border-amber-300/30 hover:bg-[#0b1830]";

function calculateCounts(
  entries: BusinessContextEntry[],
): AiBuilderSession["contextCounts"] {
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

  const updateEntry = (
    id: string,
    updates: Partial<BusinessContextEntry>,
  ) => {
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

  const updateFaq = (
    id: string,
    updates: Partial<GeneratedFaqEntry>,
  ) => {
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

  const canLaunchChat =
    session.status === "ready" && session.contextCounts.approved > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
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
            Approve, correct, or remove anything before it becomes trusted
            business knowledge.
          </p>

          <div className="mx-auto mt-7 flex max-w-3xl flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onBack}
              className={secondaryButtonClassName}
            >
              Back to results
            </button>

            <button
              type="button"
              onClick={approveAll}
              className={primaryButtonClassName}
            >
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

      <section className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={session.contextCounts.total} />
        <Stat label="Approved" value={session.contextCounts.approved} />
        <Stat label="Pending" value={session.contextCounts.proposed} />
        <Stat label="Removed" value={session.contextCounts.archived} />
      </section>

      <section className="space-y-7">
        <SectionHeading
          eyebrow="Business knowledge"
          title="Review every important business fact."
          description="Each item can be approved, corrected, or removed before your assistant uses it."
        />

        {grouped.map(([category, categoryEntries]) => (
          <section
            key={category}
            className="mx-auto max-w-4xl rounded-[26px] border border-white/[0.09] bg-[#030713] px-4 py-5 text-center shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:py-6"
          >
            <h2 className="text-2xl font-semibold text-amber-300 sm:text-3xl">
              {CATEGORY_LABELS[category]}
            </h2>

            <div className="mx-auto mt-4 grid max-w-3xl gap-3 md:grid-cols-2">
              {categoryEntries.map((entry, index) => {
                const editing = editingEntry === entry.id;
                const shouldSpanFull =
                  categoryEntries.length === 1 ||
                  (categoryEntries.length % 2 === 1 &&
                    index === categoryEntries.length - 1);

                return (
                  <article
                    key={entry.id}
                    className={`flex min-h-[190px] flex-col items-center justify-center rounded-[20px] border border-white/[0.075] bg-black/15 px-4 py-5 text-center ${
                      shouldSpanFull ? "md:col-span-2" : ""
                    }`}
                  >
                    {editing ? (
                      <div className="w-full max-w-2xl space-y-3">
                        <input
                          value={entry.title}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              title: event.target.value,
                              status: "corrected",
                              metadata: {
                                ...entry.metadata,
                                userEdited: true,
                              },
                            })
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
                        />

                        <textarea
                          rows={4}
                          value={entry.content}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              content: event.target.value,
                              status: "corrected",
                              metadata: {
                                ...entry.metadata,
                                userEdited: true,
                              },
                            })
                          }
                          className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-amber-300">
                          {entry.title}
                        </h3>

                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                          {entry.content}
                        </p>
                      </>
                    )}

                    <div className="mt-auto flex flex-wrap justify-center gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() =>
                          updateEntry(entry.id, {
                            status:
                              entry.status === "approved"
                                ? "proposed"
                                : "approved",
                          })
                        }
                        className={approveActionClassName}
                      >
                        {entry.status === "approved"
                          ? "Unapprove"
                          : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingEntry(editing ? null : entry.id)
                        }
                        className={itemActionClassName}
                      >
                        {editing ? "Done" : "Edit"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateEntry(entry.id, { status: "archived" })
                        }
                        className={itemActionClassName}
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

      <section className="space-y-7">
        <SectionHeading
          eyebrow="Generated Q&A"
          title="Questions your AI is ready to answer."
          description="Review the generated answers before they become part of the live assistant."
        />

        <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
          {session.faqEntries.map((faq, index) => {
            const editing = editingFaq === faq.id;
            const shouldSpanFull =
              session.faqEntries.length === 1 ||
              (session.faqEntries.length % 2 === 1 &&
                index === session.faqEntries.length - 1);

            return (
              <article
                key={faq.id}
                className={`flex min-h-[210px] flex-col items-center justify-center rounded-[22px] border border-white/[0.09] bg-[#030713] px-5 py-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)] ${
                  shouldSpanFull ? "md:col-span-2" : ""
                }`}
              >
                {editing ? (
                  <div className="w-full max-w-2xl space-y-3">
                    <input
                      value={faq.question}
                      onChange={(event) =>
                        updateFaq(faq.id, {
                          question: event.target.value,
                          status: "corrected",
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
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
                      className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-amber-300">
                      {faq.question}
                    </h3>

                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                      {faq.answer}
                    </p>
                  </>
                )}

                <div className="mt-auto flex flex-wrap justify-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      updateFaq(faq.id, {
                        status:
                          faq.status === "approved"
                            ? "proposed"
                            : "approved",
                      })
                    }
                    className={approveActionClassName}
                  >
                    {faq.status === "approved"
                      ? "Unapprove"
                      : "Approve"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingFaq(editing ? null : faq.id)
                    }
                    className={itemActionClassName}
                  >
                    {editing ? "Done" : "Edit"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateFaq(faq.id, { status: "archived" })
                    }
                    className={itemActionClassName}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#030713] px-3 py-4 text-center shadow-[0_14px_44px_rgba(0,0,0,0.18)] sm:px-5">
      <div className="text-2xl font-semibold text-amber-300 sm:text-3xl">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">
        {label}
      </div>
    </div>
  );
}
