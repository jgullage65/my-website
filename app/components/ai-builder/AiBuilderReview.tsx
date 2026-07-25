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

const COMPACT_TITLE_PATTERNS = [
  /^founder$/i,
  /^owner$/i,
  /^business name$/i,
  /^company name$/i,
  /^website$/i,
  /^phone$/i,
  /^email$/i,
  /^address$/i,
  /^location$/i,
  /^service area$/i,
  /^tagline/i,
  /^industry$/i,
];

const NARRATIVE_TITLE_PATTERNS = [
  /overview/i,
  /product/i,
  /service/i,
  /policy/i,
  /process/i,
  /approach/i,
  /differentiator/i,
  /how .*works/i,
  /what .*does/i,
  /additional business knowledge/i,
];

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
    order: 2_000 + Object.keys(CATEGORY_LABELS).indexOf(entry.category),
  };
}

function entryLayout(entry: BusinessContextEntry): "compact" | "narrative" {
  const presentationTag = entry.metadata.tags.find((tag) =>
    tag.startsWith("presentation:"),
  );

  if (presentationTag === "presentation:narrative") return "narrative";
  if (presentationTag === "presentation:compact") return "compact";

  if (COMPACT_TITLE_PATTERNS.some((pattern) => pattern.test(entry.title))) {
    return "compact";
  }

  if (NARRATIVE_TITLE_PATTERNS.some((pattern) => pattern.test(entry.title))) {
    return "narrative";
  }

  if (entry.content.includes("\n") || entry.content.length >= 240) {
    return "narrative";
  }

  return "compact";
}

const canonicalButtonClassName =
  "cta-raised inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0";

const filterButtonClassName =
  "cta-raised inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]";

const itemActionClassName =
  "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-bold text-white transition hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-40";

const approveActionClassName =
  "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:opacity-40";

const panelClassName =
  "overflow-hidden rounded-[14px] border border-amber-300/20 bg-[#050a16]/88 shadow-[0_12px_30px_rgba(0,0,0,0.14)] transition hover:border-amber-300/30 hover:bg-[#07101d]/92";

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
    <div className="relative w-full space-y-6 bg-[#030713] px-4 py-8 sm:px-6 sm:py-10 min-[1200px]:mx-auto min-[1200px]:max-w-[92rem] min-[1200px]:rounded-[30px] min-[1200px]:border min-[1200px]:border-white/[0.09] min-[1200px]:px-10 min-[1200px]:shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
      {confirmDialogNode}
      <AiBuilderAuthCta />

      {bulkFailureMessage ? (
        <p
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200"
          role="alert"
        >
          {bulkFailureMessage}
        </p>
      ) : null}

      <section className="border-b border-white/[0.075] pb-6 pt-10 sm:pt-4">
        <p className="text-center text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">
          Business memory review
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={onBack} className={canonicalButtonClassName}>
            Back to results
          </button>
          <button type="button" onClick={approveAll} className={canonicalButtonClassName}>
            Approve all
          </button>
          <button
            type="button"
            onClick={onLaunchChat}
            disabled={!canLaunchChat}
            className={canonicalButtonClassName}
          >
            Test assistant
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={session.contextCounts.total} />
          <Stat label="Approved" value={session.contextCounts.approved} />
          <Stat label="Pending" value={session.contextCounts.proposed} />
          <Stat label="Removed" value={session.contextCounts.archived} />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3" aria-label="Review filter">
          {(["all", "proposed", "approved", "archived"] as const).map(
            (nextFilter) => (
              <button
                key={nextFilter}
                type="button"
                onClick={() => setFilter(nextFilter)}
                className={`${filterButtonClassName} ${
                  filter === nextFilter
                    ? "border-amber-300/35 bg-[#0b1830] text-amber-200"
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
      </section>

      <div>
        {grouped.length ? (
          <section className="space-y-7">
            <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-amber-300">
              Business knowledge
            </p>

            {grouped.map(([sectionKey, section]) => (
              <section key={sectionKey}>
                <SectionDivider label={section.label} />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {section.entries.map(({ entry }) => {
                    const entryRenderKey = `context_entry:${entry.id}`;
                    const editing = editingEntry === entryRenderKey;
                    const pending = isPending("context_entry", entry.id);
                    const layout = entryLayout(entry);

                    return (
                      <article
                        key={entryRenderKey}
                        onClick={() => setSelectedItem(entryRenderKey)}
                        className={`${panelClassName} ${
                          layout === "narrative" ? "md:col-span-2" : ""
                        }`}
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
                                className="w-full rounded-xl border border-amber-300/20 bg-[#020611] px-4 py-3 text-center text-sm font-semibold text-amber-200 outline-none focus:border-amber-300/45"
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
                                className="w-full resize-y rounded-xl border border-amber-300/16 bg-[#020611] px-4 py-3 text-left text-sm leading-6 text-white outline-none focus:border-amber-300/45"
                              />
                            </div>
                          ) : (
                            <>
                              <h4 className="text-center text-base font-semibold leading-6 text-amber-300">
                                {entry.title}
                              </h4>
                              <p className="mx-auto mt-3 max-w-[72ch] whitespace-pre-wrap text-center text-sm leading-6 text-slate-300">
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
                              className={itemActionClassName}
                              disabled={pending}
                              onClick={() => {
                                if (editing) {
                                  const draft = entryDrafts[entryRenderKey] ?? {
                                    title: entry.title,
                                    content: entry.content,
                                  };
                                  void submit({
                                    itemId: entry.id,
                                    itemKind: "context_entry",
                                    expectedCurrentState: entry.status,
                                    kind: "correct",
                                    correction: {
                                      itemKind: "context_entry",
                                      ...draft,
                                    },
                                  });
                                  setEditingEntry(null);
                                } else {
                                  setEntryDrafts((drafts) => ({
                                    ...drafts,
                                    [entryRenderKey]: {
                                      title: entry.title,
                                      content: entry.content,
                                    },
                                  }));
                                  setEditingEntry(entryRenderKey);
                                }
                              }}
                            >
                              {editing ? "Save" : "Edit"}
                            </button>
                          ) : null}

                          {entry.status !== "archived" ? (
                            <button
                              type="button"
                              className={itemActionClassName}
                              disabled={pending}
                              onClick={() => void removeEntry("knowledge", entry)}
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
          <section className="mt-8 space-y-4">
            <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-amber-300">
              Generated Q&amp;A
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleFaqEntries.map(({ faq }) => {
                const faqRenderKey = `faq:${faq.id}`;
                const editing = editingFaq === faqRenderKey;
                const pending = isPending("faq", faq.id);

                return (
                  <article
                    key={faqRenderKey}
                    onClick={() => setSelectedItem(faqRenderKey)}
                    className={panelClassName}
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
                            className="w-full rounded-xl border border-amber-300/20 bg-[#020611] px-4 py-3 text-center text-sm font-semibold text-amber-200 outline-none focus:border-amber-300/45"
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
                            className="w-full resize-y rounded-xl border border-amber-300/16 bg-[#020611] px-4 py-3 text-left text-sm leading-6 text-white outline-none focus:border-amber-300/45"
                          />
                        </div>
                      ) : (
                        <>
                          <h4 className="text-center text-base font-semibold leading-6 text-amber-300">
                            {faq.question}
                          </h4>
                          <p className="mt-3 whitespace-pre-wrap text-center text-sm leading-6 text-slate-300">
                            {faq.answer}
                          </p>
                        </>
                      )}
                    </div>

                    <ItemActions>
                      {faq.status === "proposed" ? (
                        <button
                          type="button"
                          className={approveActionClassName}
                          disabled={pending}
                          onClick={() =>
                            void submit({
                              itemId: faq.id,
                              itemKind: "faq",
                              expectedCurrentState: faq.status,
                              kind: "approve",
                            })
                          }
                        >
                          Approve
                        </button>
                      ) : null}

                      {faq.status === "archived" ? (
                        <button
                          type="button"
                          className={approveActionClassName}
                          disabled={pending}
                          onClick={() =>
                            void submit({
                              itemId: faq.id,
                              itemKind: "faq",
                              expectedCurrentState: faq.status,
                              kind: "restore",
                            })
                          }
                        >
                          Restore
                        </button>
                      ) : null}

                      {faq.status !== "archived" ? (
                        <button
                          type="button"
                          className={itemActionClassName}
                          disabled={pending}
                          onClick={() => {
                            if (editing) {
                              const draft = faqDrafts[faqRenderKey] ?? {
                                question: faq.question,
                                answer: faq.answer,
                              };
                              void submit({
                                itemId: faq.id,
                                itemKind: "faq",
                                expectedCurrentState: faq.status,
                                kind: "correct",
                                correction: {
                                  itemKind: "faq",
                                  ...draft,
                                },
                              });
                              setEditingFaq(null);
                            } else {
                              setFaqDrafts((drafts) => ({
                                ...drafts,
                                [faqRenderKey]: {
                                  question: faq.question,
                                  answer: faq.answer,
                                },
                              }));
                              setEditingFaq(faqRenderKey);
                            }
                          }}
                        >
                          {editing ? "Save" : "Edit"}
                        </button>
                      ) : null}

                      {faq.status !== "archived" ? (
                        <button
                          type="button"
                          className={itemActionClassName}
                          disabled={pending}
                          onClick={() => void removeEntry("faq", faq)}
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
          <section className="rounded-[16px] border border-amber-300/20 bg-[#050a16]/88 p-8 text-center shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
            <p className="text-sm text-slate-400">No items match this filter.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-amber-300/25 bg-[#030713] px-3 py-4 text-center shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:px-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 whitespace-nowrap text-[0.68rem] font-black uppercase tracking-[0.12em] text-amber-300">
        {label}
      </p>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300/20" />
      <h3 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        {label}
      </h3>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300/20" />
    </div>
  );
}

function ItemActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.065] bg-black/10 px-4 py-3">
      {children}
    </div>
  );
}
