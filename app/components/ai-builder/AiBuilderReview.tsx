"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type {
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
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

type Props = {
  onReviewCommand: (request: ReviewCommandRequest) => Promise<void>;
  pendingReviewItems: ReadonlySet<string>;
  onBack: () => void;
  onLaunchChat: () => void;
  showLaunchChat?: boolean;
  embedded?: boolean;
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
    order: 2_000 + Object.keys(CATEGORY_LABELS).indexOf(entry.category),
  };
}

const canonicalButtonClassName =
  "cta-raised inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-300/20 bg-black px-4 py-2.5 text-xs font-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-[#0a0a0a] disabled:cursor-not-allowed disabled:border-white/[0.05] disabled:bg-black/20 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0";

const filterButtonClassName =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/[0.06] bg-[#070707] px-5 py-2.5 text-sm font-bold text-slate-300 transition hover:border-white/[0.12] hover:bg-[#101010] hover:text-white";

const itemActionClassName =
  "cta-raised min-w-0 w-full rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-bold text-white transition hover:border-amber-300/40 hover:bg-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

const approveActionClassName =
  "cta-raised min-w-0 w-full rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-bold text-white transition hover:border-amber-300/40 hover:bg-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40";

const panelClassName =
  "overflow-hidden rounded-[14px] border border-white/[0.055] bg-[#080808]/90 shadow-[0_14px_36px_rgba(0,0,0,0.2)] transition hover:border-white/[0.1] hover:bg-[#0d0d0d]/95";

function CollapsibleReviewText({
  children,
  expanded,
  onToggle,
  className = "",
}: {
  children: string;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const text = textRef.current;
    if (!text || expanded) return;

    const checkOverflow = () => {
      setCanExpand(text.scrollHeight > text.clientHeight + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(text);
    return () => observer.disconnect();
  }, [children, expanded]);

  return (
    <>
      <p
        ref={textRef}
        className={`${className} ${!expanded ? "line-clamp-3" : ""}`}
      >
        {children}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="mx-auto mt-2 block text-xs font-semibold text-amber-300 transition hover:text-amber-200"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </>
  );
}

export default function AiBuilderReview({
  onReviewCommand,
  pendingReviewItems,
  onBack,
  onLaunchChat,
  showLaunchChat = true,
  embedded = false,
}: Props) {
  const { session } = useAiBuilderWorkspace();
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<ReadonlySet<string>>(
    new Set(),
  );
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  const contextEntries = session.contextEntries;
  const faqEntries = session.faqEntries;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

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
      if (
        normalizedSearchQuery &&
        !`${entry.title} ${entry.content} ${section.label} ${entry.category}`
          .toLowerCase()
          .includes(normalizedSearchQuery)
      ) {
        return;
      }

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
  }, [contextEntries, faqEntries, filter, normalizedSearchQuery]);

  const visibleFaqEntries = useMemo(
    () =>
      faqEntries.flatMap((faq) => {
        const visible =
          filter === "all"
            ? faq.status !== "archived"
            : filter === "approved"
              ? faq.status === "approved" || faq.status === "corrected"
              : faq.status === filter;
        if (!visible) return [];
        if (
          normalizedSearchQuery &&
          !`${faq.question} ${faq.answer} generated q&a faq`
            .toLowerCase()
            .includes(normalizedSearchQuery)
        ) {
          return [];
        }
        return [{ faq }];
      }),
    [faqEntries, filter, normalizedSearchQuery],
  );

  const visibleItemCount = useMemo(
    () => grouped.reduce((total, [, section]) => total + section.entries.length, 0) + visibleFaqEntries.length,
    [grouped, visibleFaqEntries],
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

  const toggleExpanded = (itemKey: string) => {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  };

  const removeEntry = async (
    kind: "knowledge" | "faq",
    entry: BusinessContextEntry | GeneratedFaqEntry,
  ) => {
    const confirmed = await showConfirm({
      title: "Remove information?",
      message:
        "This information will be removed from the active review list and will not be used by your assistant. You can restore it from Removed later.",
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
    if (!decisions.length || pendingReviewItems.size > 0) return;

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
  const canApproveAll = session.contextCounts.proposed > 0 && pendingReviewItems.size === 0;

  const summaryItems = [
    { filter: "all" as const, label: "Total", value: session.contextCounts.total, buttonLabel: "All" },
    { filter: "approved" as const, label: "Approved", value: session.contextCounts.approved, buttonLabel: "Approved" },
    { filter: "proposed" as const, label: "Pending", value: session.contextCounts.proposed, buttonLabel: "Pending" },
    { filter: "archived" as const, label: "Removed", value: session.contextCounts.archived, buttonLabel: "Removed" },
  ];

  return (
    <div className={embedded ? "relative w-full space-y-5" : "relative w-full space-y-6 bg-[#000000] px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 min-[1200px]:mx-auto min-[1200px]:max-w-[92rem] min-[1200px]:rounded-[30px] min-[1200px]:border min-[1200px]:border-white/[0.09] min-[1200px]:px-10 min-[1200px]:shadow-[0_18px_60px_rgba(0,0,0,0.2)]"}>
      {confirmDialogNode}
      {!embedded ? <AiBuilderAuthCta /> : null}

      {bulkFailureMessage ? (
        <p
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200"
          role="alert"
        >
          {bulkFailureMessage}
        </p>
      ) : null}

      <section className="border-b border-white/[0.075] pb-6 pt-4 sm:pt-2">
        {!embedded ? (
          <p className="text-center text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">
            Business Knowledge review
          </p>
        ) : null}

        {embedded ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {summaryItems.map((item) => (
                <div key={item.filter} className="min-w-0 space-y-3">
                  <Stat label={item.label} value={item.value} />
                  <button
                    type="button"
                    onClick={() => setFilter(item.filter)}
                    className={`${filterButtonClassName} ${
                      filter === item.filter
                        ? "border-white/[0.14] bg-[#141414] text-white shadow-[0_8px_22px_rgba(0,0,0,0.2)]"
                        : ""
                    }`}
                    aria-pressed={filter === item.filter}
                  >
                    {item.buttonLabel}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search Business Knowledge</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search Business Knowledge and Q&A..."
                  className="min-h-11 w-full rounded-lg border border-white/[0.08] bg-[#070707] px-4 pr-10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/35"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear Business Knowledge search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-500 transition hover:text-white"
                  >
                    ×
                  </button>
                ) : null}
              </label>
              <span className="shrink-0 text-center text-xs font-semibold text-slate-500 sm:text-right">
                {visibleItemCount} matching item{visibleItemCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mx-auto mt-6 w-full max-w-[calc(50%-0.375rem)]">
              <button
                type="button"
                onClick={approveAll}
                disabled={!canApproveAll}
                className={`${canonicalButtonClassName} w-full text-amber-300`}
              >
                {pendingReviewItems.size > 0 ? "Saving review changes..." : session.contextCounts.proposed > 0 ? `Approve all ${session.contextCounts.proposed}` : "No pending items"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`mt-6 grid grid-cols-1 gap-3 ${showLaunchChat ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <button type="button" onClick={onBack} className={canonicalButtonClassName}>
                Back to results
              </button>
              <button type="button" onClick={approveAll} disabled={!canApproveAll} className={`${canonicalButtonClassName} text-amber-300`}>
                {pendingReviewItems.size > 0 ? "Saving review changes..." : session.contextCounts.proposed > 0 ? `Approve all ${session.contextCounts.proposed}` : "No pending items"}
              </button>
              {showLaunchChat ? (
                <button
                  type="button"
                  onClick={onLaunchChat}
                  disabled={!canLaunchChat}
                  className={canonicalButtonClassName}
                >
                  Test assistant
                </button>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={session.contextCounts.total} />
              <Stat label="Approved" value={session.contextCounts.approved} />
              <Stat label="Pending" value={session.contextCounts.proposed} />
              <Stat label="Removed" value={session.contextCounts.archived} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Review filter">
              {summaryItems.map((item) => (
                <button
                  key={item.filter}
                  type="button"
                  onClick={() => setFilter(item.filter)}
                  className={`${filterButtonClassName} ${
                    filter === item.filter
                      ? "border-white/[0.14] bg-[#141414] text-white shadow-[0_8px_22px_rgba(0,0,0,0.2)]"
                      : ""
                  }`}
                  aria-pressed={filter === item.filter}
                >
                  {item.buttonLabel}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search Business Knowledge</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search Business Knowledge and Q&A..."
                  className="min-h-11 w-full rounded-lg border border-white/[0.08] bg-[#070707] px-4 pr-10 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/35"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear Business Knowledge search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-500 transition hover:text-white"
                  >
                    ×
                  </button>
                ) : null}
              </label>
              <span className="shrink-0 text-center text-xs font-semibold text-slate-500 sm:text-right">
                {visibleItemCount} matching item{visibleItemCount === 1 ? "" : "s"}
              </span>
            </div>
          </>
        )}
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

                <div className={`grid grid-cols-1 gap-4 ${embedded ? "xl:grid-cols-2" : ""}`}>
                  {section.entries.map(({ entry }) => {
                    const entryRenderKey = `context_entry:${entry.id}`;
                    const editing = editingEntry === entryRenderKey;
                    const pending = isPending("context_entry", entry.id);
                    const expanded = expandedItems.has(entryRenderKey);

                    return (
                      <article
                        key={entryRenderKey}
                        onClick={() => setSelectedItem(entryRenderKey)}
                        className={`${panelClassName} ${embedded && section.entries.length === 1 ? "xl:col-span-2" : ""}`}
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
                                className="w-full rounded-xl border border-white/[0.08] bg-[#020202] px-4 py-3 text-center text-sm font-semibold text-amber-200 outline-none transition focus:border-amber-300/35"
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
                                className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#020202] px-4 py-3 text-left text-sm leading-6 text-white outline-none transition focus:border-amber-300/35"
                              />
                            </div>
                          ) : (
                            <>
                              <h4 className="text-center text-base font-semibold leading-6 text-white">
                                {entry.title}
                              </h4>
                              <CollapsibleReviewText
                                expanded={expanded}
                                onToggle={() => toggleExpanded(entryRenderKey)}
                                className="mx-auto mt-3 max-w-[72ch] whitespace-pre-wrap text-center text-sm leading-6 text-slate-300"
                              >
                                {entry.content}
                              </CollapsibleReviewText>
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

                          {entry.status === "proposed" || entry.status === "approved" ? (
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

            <div className={`grid grid-cols-1 gap-4 ${embedded ? "xl:grid-cols-2" : ""}`}>
              {visibleFaqEntries.map(({ faq }) => {
                const faqRenderKey = `faq:${faq.id}`;
                const editing = editingFaq === faqRenderKey;
                const pending = isPending("faq", faq.id);
                const expanded = expandedItems.has(faqRenderKey);

                return (
                  <article
                    key={faqRenderKey}
                    onClick={() => setSelectedItem(faqRenderKey)}
                    className={`${panelClassName} ${embedded && visibleFaqEntries.length === 1 ? "xl:col-span-2" : ""}`}
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
                            className="w-full rounded-xl border border-white/[0.08] bg-[#020202] px-4 py-3 text-center text-sm font-semibold text-amber-200 outline-none transition focus:border-amber-300/35"
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
                            className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#020202] px-4 py-3 text-left text-sm leading-6 text-white outline-none transition focus:border-amber-300/35"
                          />
                        </div>
                      ) : (
                        <>
                          <h4 className="text-center text-base font-semibold leading-6 text-white">
                            {faq.question}
                          </h4>
                          <CollapsibleReviewText
                            expanded={expanded}
                            onToggle={() => toggleExpanded(faqRenderKey)}
                            className="mt-3 whitespace-pre-wrap text-center text-sm leading-6 text-slate-300"
                          >
                            {faq.answer}
                          </CollapsibleReviewText>
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

                      {faq.status === "proposed" || faq.status === "approved" ? (
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
          <section className="rounded-[16px] border border-white/[0.055] bg-[#080808]/90 p-8 text-center shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
            <p className="text-sm text-slate-400">
              {normalizedSearchQuery ? "No Business Knowledge matches this search and filter." : "No items match this filter."}
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.05] bg-[#050505] px-3 py-4 text-center shadow-[0_10px_24px_rgba(0,0,0,0.16)] sm:px-4">
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
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.08]" />
      <h3 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        {label}
      </h3>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.08]" />
    </div>
  );
}

function ItemActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-nowrap items-center gap-2 border-t border-white/[0.065] bg-black/10 px-4 py-3 [&>*]:min-w-0 [&>*]:flex-1">
      {children}
    </div>
  );
}
