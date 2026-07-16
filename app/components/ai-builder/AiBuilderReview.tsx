"use client";

import { useMemo, useState } from "react";
import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
  BusinessContextStatus,
  GeneratedFaqEntry,
} from "@/app/lib/ai-engine/contracts";
import type { BuilderState } from "./AiBuilderClient";

type Props = {
  builder: BuilderState;
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

function calculateCounts(
  entries: BusinessContextEntry[],
): AiBuilderSession["contextCounts"] {
  const byCategory: AiBuilderSession["contextCounts"]["byCategory"] = {};

  entries.forEach((entry) => {
    byCategory[entry.category] =
      (byCategory[entry.category] ?? 0) + 1;
  });

  return {
    total: entries.length,
    approved: entries.filter(
      (entry) =>
        entry.status === "approved" ||
        entry.status === "corrected",
    ).length,
    proposed: entries.filter(
      (entry) => entry.status === "proposed",
    ).length,
    archived: entries.filter(
      (entry) => entry.status === "archived",
    ).length,
    byCategory,
  };
}

export default function AiBuilderReview({
  builder,
  session,
  onSessionChange,
  onBack,
  onLaunchChat,
}: Props) {
  const [editingEntry, setEditingEntry] =
    useState<string | null>(null);
  const [editingFaq, setEditingFaq] =
    useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<
      BusinessContextCategory,
      BusinessContextEntry[]
    >();

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
        ? {
            ...entry,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
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
          ? {
              ...faq,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
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
    session.status === "ready" &&
    session.contextCounts.approved > 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-400">
          Business loaded
        </p>

        <h2 className="mt-2 text-3xl font-bold text-white">
          Review what {builder.assistantName} learned.
        </h2>

        <p className="mt-2 text-neutral-400">
          Approve, correct, or remove anything before it becomes
          authoritative business knowledge.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-white"
          >
            Back to results
          </button>

          <button
            type="button"
            onClick={approveAll}
            className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black"
          >
            Approve all knowledge
          </button>

          <button
            type="button"
            onClick={onLaunchChat}
            disabled={!canLaunchChat}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-300 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
          >
            Test live assistant
          </button>
        </div>

        {!canLaunchChat ? (
          <p className="mt-3 text-xs text-neutral-500">
            Approve the business knowledge before opening the live assistant.
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={session.contextCounts.total} />
        <Stat label="Approved" value={session.contextCounts.approved} />
        <Stat label="Proposed" value={session.contextCounts.proposed} />
        <Stat label="Removed" value={session.contextCounts.archived} />
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Business Knowledge
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Every fact remains tied to its source text.
          </p>
        </div>

        {grouped.map(([category, categoryEntries]) => (
          <div
            key={category}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {CATEGORY_LABELS[category]}
              </h3>
              <span className="text-sm text-neutral-400">
                {categoryEntries.length}
              </span>
            </div>

            <div className="space-y-3">
              {categoryEntries.map((entry) => {
                const editing = editingEntry === entry.id;

                return (
                  <article
                    key={entry.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4"
                  >
                    {editing ? (
                      <div className="space-y-3">
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
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
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
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-white">
                            {entry.title}
                          </h4>
                          <StatusPill status={entry.status} />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-neutral-300">
                          {entry.content}
                        </p>
                      </>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
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
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
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
                        className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-white"
                      >
                        {editing ? "Done" : "Edit"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateEntry(entry.id, {
                            status: "archived",
                          })
                        }
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-white">
          Generated Q&A
        </h2>

        <div className="space-y-3">
          {session.faqEntries.map((faq) => {
            const editing = editingFaq === faq.id;

            return (
              <article
                key={faq.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
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
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
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
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white">
                        {faq.question}
                      </h3>
                      <StatusPill status={faq.status} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-300">
                      {faq.answer}
                    </p>
                  </>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
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
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300"
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
                    className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-white"
                  >
                    {editing ? "Done" : "Edit"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateFaq(faq.id, {
                        status: "archived",
                      })
                    }
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300"
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

function StatusPill({
  status,
}: {
  status: BusinessContextStatus;
}) {
  const label =
    status === "corrected"
      ? "Corrected"
      : status === "approved"
        ? "Approved"
        : status === "archived"
          ? "Removed"
          : "Proposed";

  return (
    <span className="rounded-full border border-neutral-700 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-300">
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="text-2xl font-bold text-white">
        {value}
      </div>
      <div className="mt-1 text-sm text-neutral-400">
        {label}
      </div>
    </div>
  );
}
