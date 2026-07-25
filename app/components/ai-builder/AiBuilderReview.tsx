"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextEntry,
  GeneratedFaqEntry,
} from "@/app/lib/ai-engine/contracts";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import {
  WEBSITE_KNOWLEDGE_CATEGORIES,
  WEBSITE_KNOWLEDGE_SECTION_LABELS,
  WEBSITE_KNOWLEDGE_SECTION_ORDER,
  type WebsiteKnowledgeFact,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import AiBuilderAuthCta from "./AiBuilderAuthCta";

type Props = {
  session: AiBuilderSession;
  onReviewCommand: (request: ReviewCommandRequest) => Promise<void>;
  pendingReviewItems: ReadonlySet<string>;
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

const websiteCategorySet = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);
const sectionOrder = new Map<string, number>(
  WEBSITE_KNOWLEDGE_SECTION_ORDER.map((section, index) => [section, index]),
);

function reviewSection(entry: BusinessContextEntry): {
  key: string;
  label: string;
  order: number;
} {
  const websiteCategory = entry.metadata.tags.find((tag) =>
    websiteCategorySet.has(tag),
  ) as WebsiteKnowledgeFact["category"] | undefined;

  if (websiteCategory) {
    const canonicalKey =
      ({
        business_identity: "company_overview",
        industry: "industry_served",
        customer: "customer_segment",
        pricing: "pricing_plan",
        process: "support_onboarding",
        differentiator: "competitive_differentiator",
        guarantee: "policy",
        location: "location_service_area",
        contact: "contact_information",
        other: "additional_business_knowledge",
      } as Partial<Record<WebsiteKnowledgeFact["category"], string>>)[
        websiteCategory
      ] ?? websiteCategory;

    return {
      key: canonicalKey,
      label: WEBSITE_KNOWLEDGE_SECTION_LABELS[websiteCategory],
      order: sectionOrder.get(canonicalKey) ?? 1_000,
    };
  }

  return {
    key: `legacy:${entry.category}`,
    label: CATEGORY_LABELS[entry.category],
    order:
      2_000 + Object.keys(CATEGORY_LABELS).indexOf(entry.category),
  };
}

const primaryButtonClassName =
  "rounded-xl border border-amber-300/20 bg-[#081226] px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0";

const secondaryButtonClassName =
  "rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-amber-300/25 hover:bg-white/[0.045] hover:text-white";

const itemActionClassName =
  "rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-2 text-[0.72rem] font-semibold text-slate-300 transition hover:border-amber-300/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

const approveActionClassName =
  "rounded-lg border border-amber-300/20 bg-amber-300/[0.055] px-3 py-2 text-[0.72rem] font-bold text-amber-300 transition hover:border-amber-300/35 hover:bg-amber-300/[0.09] disabled:cursor-not-allowed disabled:opacity-40";

const panelClassName =
  "break-inside-avoid overflow-hidden rounded-[16px] border border-white/[0.075] bg-[#050a16]/82 shadow-[0_12px_34px_rgba(0,0,0,0.16)] transition hover:border-amber-300/15";

export default function AiBuilderReview({
  session,
  onReviewCommand,
  pendingReviewItems,
  onBack,
  onLaunchChat,
}: Props) {
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [entryDrafts, setEntryDrafts] = useState<
    Record<string, { title: string; content: string }>
  >({});
  const [faqDrafts, setFaqDrafts] = useState<
    Record<string, { question: string; answer: string }>
  >({});
  const [bulkFailureMessage, setBulkFailureMessage] = useState<string | null>(
    null,
  );
  const [filter, setFilter] = useState<
    "all" | "proposed" | "approved" | "archived"
  >("all");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  const contextEntries = session.contextEntries;
  const faqEntries = session.faqEntries;

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        order: number;
        entries: Array<{ entry: BusinessContextEntry }>;
      }
    >();
    const faqBackedContextIds = new Set(
      faqEntries.flatMap((faq) => faq.sourceEntryIds),
    );

    contextEntries.forEach((entry) => {
      if (faqBackedContextIds.has(entry.id)) return;

      const visible =
        filter === "all"
          ? entry.status !== "archived"
          : filter === "approved"
            ? entry.status === "approved" || entry.status === "corrected"
            : entry.status === filter;

      if (!visible) return;

      const section = reviewSection(entry);
      const current = map.get(section.key) ?? {
        label: section.label,
        order: section.order,
        entries: [],
      };
      map.set(section.key, {
        ...current,
        entries: current.entries.concat({ entry }),
      });
    });

    return Array.from(map.entries()).sort(
      ([, left], [, right]) =>
        left.order - right.order || left.label.localeCompare(right.label),
    );
  }, [contextEntries, faqEntries, filter]);

  const visibleFaqEntries = useMemo(
    () =>
      faqEntries.flatMap((faq) => {
        const visible =
          filter === "all"
            ? faq.status !== "archived"
            : filter === "approved"
              ? faq.status === "approved" || faq.status === "corrected"
              : faq.status === filter;
        return visible ? [{ faq }] : [];
      }),
    [faqEntries, filter],
  );

  const visibleItemKeys = useMemo(
    () => [
      ...grouped.flatMap(([, section]) =>
        section.entries.map(({ entry }) => `context_entry:${entry.id}`),
      ),
      ...visibleFaqEntries.map(({ faq }) => `faq:${faq.id}`),
    ],
    [grouped, visibleFaqEntries],
  );

  useEffect(() => {
    if (selectedItem && !visibleItemKeys.includes(selectedItem)) {
      setSelectedItem(visibleItemKeys[0] ?? null);
    }
  }, [selectedItem, visibleItemKeys]);

  const submit = (
    request: Omit<
      ReviewCommandRequest,
      "commandId" | "projectId" | "clientRevision"
    >,
  ) =>
    onReviewCommand({
      ...request,
      commandId: crypto.randomUUID(),
      projectId: session.id,
      clientRevision: session.governanceRevision ?? 0,
    } as ReviewCommandRequest);

  const isPending = (itemKind: "context_entry" | "faq", itemId: string) =>
    pendingReviewItems.has(`${itemKind}:${itemId}`);

  const removeEntry = async (
    kind: "knowledge" | "faq",
    entry: BusinessContextEntry | GeneratedFaqEntry,
  ) => {
    const confirmed = await showConfirm({
      title: "Remove information?",
      message:
        "This information will be removed from the review list and will not be used by your assistant.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });

    if (!confirmed) return;

    await submit({
      itemId: entry.id,
      itemKind: kind === "knowledge" ? "context_entry" : "faq",
      expectedCurrentState: entry.status,
      kind: entry.status === "proposed" ? "reject" : "archive",
    });
  };

  const approveAll = async () => {
    setBulkFailureMessage(null);
    const decisions = [...contextEntries, ...faqEntries].filter(
      (entry) => entry.status === "proposed",
    );
    const outcomes: PromiseSettledResult<void>[] = [];

    for (const entry of decisions) {
      outcomes.push(
        await Promise.resolve(
          submit({
            itemId: entry.id,
            itemKind: "category" in entry ? "context_entry" : "faq",
            expectedCurrentState: entry.status,
            kind: "approve",
          }),
        ).then(
          () => ({ status: "fulfilled", value: undefined }) as const,
          (reason) => ({ status: "rejected", reason }) as const,
        ),
      );
    }

    const failed = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    ).length;

    if (failed) {
      setBulkFailureMessage(
        `${failed} item${failed === 1 ? "" : "s"} could not be approved. Review and retry those items.`,
      );
    }
  };

  const canLaunchChat =
    session.status === "ready" && session.contextCounts.approved > 0;

  return (
    <div className="mx-auto w-full max-w-[92rem] space-y-6 px-4 pb-10 sm:px-6 xl:px-8">
      {confirmDialogNode}

      {bulkFailureMessage ? (
        <p
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200"
          role="alert"
        >
          {bulkFailureMessage}
        </p>
      ) : null}

      <section className="border-b border-white/[0.075] px-1 pb-5 pt-2">
        <AiBuilderAuthCta />
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              Business memory review
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Review what your <span className="text-amber-300">AI learned.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Approve, correct, or remove anything before it becomes trusted business knowledge.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <button type="button" onClick={onBack} className={secondaryButtonClassName}>
              Back to results
            </button>
            <button type="button" onClick={approveAll} className={primaryButtonClassName}>
              Approve all
            </button>
            <button
              type="button"
              onClick={onLaunchChat}
              disabled={!canLaunchChat}
              className={primaryButtonClassName}
            >
              Test assistant
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
            <Stat label="Total" value={session.contextCounts.total} />
            <Stat label="Approved" value={session.contextCounts.approved} />
            <Stat label="Pending" value={session.contextCounts.proposed} />
            <Stat label="Removed" value={session.contextCounts.archived} />
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Review filter">
            {(["all", "proposed", "approved", "archived"] as const).map(
              (nextFilter) => (
                <button
                  key={nextFilter}
                  type="button"
                  onClick={() => setFilter(nextFilter)}
                  className={`${secondaryButtonClassName} ${
                    filter === nextFilter
                      ? "border-amber-300/30 bg-amber-300/[0.075] text-amber-200"
                      : ""
                  }`}
                  aria-pressed={filter === nextFilter}
                >
                  {nextFilter === "all"
                    ? "All"
                    : nextFilter === "archived"
                      ? "Removed"
                      : nextFilter === "proposed"
                        ? "Pending"
                        : "Approved"}
                </button>
              ),
            )}
          </div>
        </div>
      </section>

      {grouped.length ? (
        <section className="space-y-7">
          <SectionHeading
            eyebrow="Business knowledge"
            title={
              <>
                Review every <span className="text-amber-300">important business fact.</span>
              </>
            }
            description="Each item stays compact, expands naturally with its content, and can be approved, corrected, or removed."
          />

          {grouped.map(([sectionKey, section]) => (
            <section key={sectionKey}>
              <div className="mb-3 flex items-center gap-3 px-1">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {section.label}
                </h3>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <div className="columns-1 gap-4 md:columns-2">
                {section.entries.map(({ entry }) => {
                  const entryRenderKey = `context_entry:${entry.id}`;
                  const editing = editingEntry === entryRenderKey;
                  const pending = isPending("context_entry", entry.id);

                  return (
                    <article
                      key={entryRenderKey}
                      onClick={() => setSelectedItem(entryRenderKey)}
                      className={`${panelClassName} mb-4`}
                    >
                      <div className="px-5 py-4 sm:px-6 sm:py-5">
                        {editing ? (
                          <div className="space-y-3">
                            <input
                              value={entryDrafts[entryRenderKey]?.title ?? entry.title}
                              onChange={(event) =>
                                setEntryDrafts((drafts) => ({
                                  ...drafts,
                                  [entryRenderKey]: {
                                    ...(drafts[entryRenderKey] ?? {
                                      title: entry.title,
                                      content: entry.content,
                                    }),
                                    title: event.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-sm font-semibold text-amber-200 outline-none focus:border-amber-300/45"
                            />
                            <textarea
                              rows={5}
                              value={entryDrafts[entryRenderKey]?.content ?? entry.content}
                              onChange={(event) =>
                                setEntryDrafts((drafts) => ({
                                  ...drafts,
                                  [entryRenderKey]: {
                                    ...(drafts[entryRenderKey] ?? {
                                      title: entry.title,
                                      content: entry.content,
                                    }),
                                    content: event.target.value,
                                  },
                                }))
                              }
                              className="w-full resize-y rounded-xl border border-white/10 bg-[#020611] px-4 py-3 text-left text-sm leading-6 text-white outline-none focus:border-amber-300/45"
                            />
                          </div>
                        ) : (
                          <>
                            <h4 className="text-center text-base font-semibold leading-6 text-amber-300">
                              {entry.title}
                            </h4>
                            <p className="mx-auto mt-3 max-w-[72ch] whitespace-pre-wrap text-left text-sm leading-6 text-slate-300">
                              {entry.content}
                            </p>
                          </>
                        )}
                      </div>

                      <ItemActions>
                        {entry.status === "proposed" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void submit({
                                itemId: entry.id,
                                itemKind: "context_entry",
                                expectedCurrentState: entry.status,
                                kind: "approve",
                              })
                            }
                            className={approveActionClassName}
                            disabled={pending}
                          >
                            Approve
                          </button>
                        ) : null}

                        {entry.status === "archived" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void submit({
                                itemId: entry.id,
                                itemKind: "context_entry",
                                expectedCurrentState: entry.status,
                                kind: "restore",
                              })
                            }
                            className={approveActionClassName}
                            disabled={pending}
                          >
                            Restore
                          </button>
                        ) : null}

                        {entry.status !== "archived" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (editing) {
                                const draft = entryDrafts[entryRenderKey];
                                if (
                                  !draft ||
                                  (draft.title === entry.title &&
                                    draft.content === entry.content)
                                ) {
                                  setEditingEntry(null);
                                  return;
                                }
                                void submit({
                                  itemId: entry.id,
                                  itemKind: "context_entry",
                                  expectedCurrentState: entry.status,
                                  kind: "correct",
                                  correction: {
                                    itemKind: "context_entry",
                                    title: draft.title,
                                    content: draft.content,
                                    category: entry.category,
                                  },
                                })
                                  .then(() => setEditingEntry(null))
                                  .catch(() => undefined);
                              } else {
                                setEditingEntry(entryRenderKey);
                              }
                            }}
                            className={itemActionClassName}
                            disabled={pending}
                          >
                            {editing ? "Save" : "Edit"}
                          </button>
                        ) : null}

                        {entry.status !== "archived" ? (
                          <button
                            type="button"
                            onClick={() => void removeEntry("knowledge", entry)}
                            className={itemActionClassName}
                            disabled={pending}
                          >
                            Remove
                          </button>
                        ) : null}
                      </ItemActions>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      ) : null}

      {visibleFaqEntries.length ? (
        <section className="space-y-5 border-t border-white/[0.075] pt-7">
          <SectionHeading
            eyebrow="Generated Q&A"
            title={
              <>
                Questions your <span className="text-amber-300">AI is ready</span> to answer.
              </>
            }
            description="Review the generated answers before they become part of the live assistant."
          />

          <div className="columns-1 gap-4 md:columns-2">
            {visibleFaqEntries.map(({ faq }) => {
              const faqRenderKey = `faq:${faq.id}`;
              const editing = editingFaq === faqRenderKey;
              const pending = isPending("faq", faq.id);

              return (
                <article
                  key={faqRenderKey}
                  onClick={() => setSelectedItem(faqRenderKey)}
                  className={`${panelClassName} mb-4`}
                >
                  <div className="px-5 py-4 sm:px-6 sm:py-5">
                    {editing ? (
                      <div className="space-y-3">
                        <input
                          value={faqDrafts[faqRenderKey]?.question ?? faq.question}
                          onChange={(event) =>
                            setFaqDrafts((drafts) => ({
                              ...drafts,
                              [faqRenderKey]: {
                                ...(drafts[faqRenderKey] ?? {
                                  question: faq.question,
                                  answer: faq.answer,
                                }),
                                question: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-sm font-semibold text-amber-200 outline-none focus:border-amber-300/45"
                        />
                        <textarea
                          rows={5}
                          value={faqDrafts[faqRenderKey]?.answer ?? faq.answer}
                          onChange={(event) =>
                            setFaqDrafts((drafts) => ({
                              ...drafts,
                              [faqRenderKey]: {
                                ...(drafts[faqRenderKey] ?? {
                                  question: faq.question,
                                  answer: faq.answer,
                                }),
                                answer: event.target.value,
                              },
                            }))
                          }
                          className="w-full resize-y rounded-xl border border-white/10 bg-[#020611] px-4 py-3 text-left text-sm leading-6 text-white outline-none focus:border-amber-300/45"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-center text-base font-semibold leading-6 text-amber-300">
                          {faq.question}
                        </h3>
                        <p className="mx-auto mt-3 max-w-[72ch] whitespace-pre-wrap text-left text-sm leading-6 text-slate-300">
                          {faq.answer}
                        </p>
                      </>
                    )}
                  </div>

                  <ItemActions>
                    {faq.status === "proposed" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void submit({
                            itemId: faq.id,
                            itemKind: "faq",
                            expectedCurrentState: faq.status,
                            kind: "approve",
                          })
                        }
                        className={approveActionClassName}
                        disabled={pending}
                      >
                        Approve
                      </button>
                    ) : null}

                    {faq.status === "archived" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void submit({
                            itemId: faq.id,
                            itemKind: "faq",
                            expectedCurrentState: faq.status,
                            kind: "restore",
                          })
                        }
                        className={approveActionClassName}
                        disabled={pending}
                      >
                        Restore
                      </button>
                    ) : null}

                    {faq.status !== "archived" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (editing) {
                            const draft = faqDrafts[faqRenderKey];
                            if (
                              !draft ||
                              (draft.question === faq.question &&
                                draft.answer === faq.answer)
                            ) {
                              setEditingFaq(null);
                              return;
                            }
                            void submit({
                              itemId: faq.id,
                              itemKind: "faq",
                              expectedCurrentState: faq.status,
                              kind: "correct",
                              correction: {
                                itemKind: "faq",
                                question: draft.question,
                                answer: draft.answer,
                              },
                            })
                              .then(() => setEditingFaq(null))
                              .catch(() => undefined);
                          } else {
                            setEditingFaq(faqRenderKey);
                          }
                        }}
                        className={itemActionClassName}
                        disabled={pending}
                      >
                        {editing ? "Save" : "Edit"}
                      </button>
                    ) : null}

                    {faq.status !== "archived" ? (
                      <button
                        type="button"
                        onClick={() => void removeEntry("faq", faq)}
                        className={itemActionClassName}
                        disabled={pending}
                      >
                        Remove
                      </button>
                    ) : null}
                  </ItemActions>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!grouped.length && !visibleFaqEntries.length ? (
        <section className="rounded-2xl border border-white/[0.075] bg-[#050a16]/82 px-5 py-10 text-center">
          <p className="text-lg font-semibold text-white">
            No knowledge matches this review filter.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Choose another status to continue reviewing business knowledge.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function ItemActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 border-t border-white/[0.06] bg-black/10 px-4 py-3">
      {children}
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
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-amber-300">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[76px] rounded-xl border border-white/[0.075] bg-white/[0.025] px-3 py-2 text-center">
      <div className="text-lg font-semibold text-amber-300">{value}</div>
      <div className="mt-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </div>
    </div>
  );
}
