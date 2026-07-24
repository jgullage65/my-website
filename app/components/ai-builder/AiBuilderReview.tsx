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
const sectionOrder = new Map<string, number>(WEBSITE_KNOWLEDGE_SECTION_ORDER.map((section, index) => [section, index]));

function reviewSection(entry: BusinessContextEntry): { key: string; label: string; order: number } {
  const websiteCategory = entry.metadata.tags.find((tag) => websiteCategorySet.has(tag)) as WebsiteKnowledgeFact["category"] | undefined;
  if (websiteCategory) {
    const canonicalKey = ({
      business_identity: "company_overview", industry: "industry_served", customer: "customer_segment",
      pricing: "pricing_plan", process: "support_onboarding", differentiator: "competitive_differentiator",
      guarantee: "policy", location: "location_service_area", contact: "contact_information",
      other: "additional_business_knowledge",
    } as Partial<Record<WebsiteKnowledgeFact["category"], string>>)[websiteCategory] ?? websiteCategory;
    return { key: canonicalKey, label: WEBSITE_KNOWLEDGE_SECTION_LABELS[websiteCategory], order: sectionOrder.get(canonicalKey) ?? 1_000 };
  }
  return { key: `legacy:${entry.category}`, label: CATEGORY_LABELS[entry.category], order: 2_000 + Object.keys(CATEGORY_LABELS).indexOf(entry.category) };
}

const primaryButtonClassName =
  "rounded-2xl border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_34px_rgba(245,158,11,0.18)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-black/20 disabled:text-slate-600 disabled:shadow-none disabled:hover:translate-y-0";

const secondaryButtonClassName =
  "rounded-2xl border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-semibold text-white transition hover:border-amber-300/30 hover:bg-[#0b1830]";

const itemActionClassName =
  "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-bold text-white transition hover:border-amber-300/30 hover:bg-[#0b1830]";

const approveActionClassName =
  "rounded-xl border border-amber-300/15 bg-[#081226] px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:border-amber-300/30 hover:bg-[#0b1830]";

export default function AiBuilderReview({
  session,
  onReviewCommand,
  pendingReviewItems,
  onBack,
  onLaunchChat,
}: Props) {
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, { title: string; content: string }>>({});
  const [faqDrafts, setFaqDrafts] = useState<Record<string, { question: string; answer: string }>>({});
  const [bulkFailureMessage, setBulkFailureMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "proposed" | "approved" | "archived">("all");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  const contextEntries = session.contextEntries;
  const faqEntries = session.faqEntries;

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; order: number; entries: Array<{ entry: BusinessContextEntry }> }>();
    const faqBackedContextIds = new Set(faqEntries.flatMap((faq) => faq.sourceEntryIds));

    contextEntries.forEach((entry) => {
      // Website FAQ observations have a canonical FAQ review item. Do not also
      // render their evidence-link context row as a second review card.
      if (faqBackedContextIds.has(entry.id)) return;
      if (
        filter === "all"
          ? entry.status !== "archived"
          : filter === "approved"
            ? entry.status === "approved" || entry.status === "corrected"
            : entry.status === filter
      ) {
        const section = reviewSection(entry);
        const current = map.get(section.key) ?? { label: section.label, order: section.order, entries: [] };
        map.set(section.key, { ...current, entries: current.entries.concat({ entry }) });
      }
    });

    return Array.from(map.entries()).sort(([, left], [, right]) => left.order - right.order || left.label.localeCompare(right.label));
  }, [contextEntries, faqEntries, filter]);

  const visibleFaqEntries = useMemo(
    () =>
      faqEntries.flatMap((faq) =>
        (filter === "all"
          ? faq.status !== "archived"
          : filter === "approved"
            ? faq.status === "approved" || faq.status === "corrected"
            : faq.status === filter)
          ? [{ faq }]
          : [],
      ),
    [faqEntries, filter],
  );

  const visibleItemKeys = useMemo(
    () => [
      ...grouped.flatMap(([, section]) => section.entries.map(({ entry }) => `context_entry:${entry.id}`)),
      ...visibleFaqEntries.map(({ faq }) => `faq:${faq.id}`),
    ],
    [grouped, visibleFaqEntries],
  );

  useEffect(() => {
    if (selectedItem && !visibleItemKeys.includes(selectedItem)) {
      setSelectedItem(visibleItemKeys[0] ?? null);
    }
  }, [selectedItem, visibleItemKeys]);

  const commandId = () => crypto.randomUUID();

  const submit = (request: Omit<ReviewCommandRequest, "commandId" | "projectId" | "clientRevision">) =>
    onReviewCommand({
      ...request,
      commandId: commandId(),
      projectId: session.id,
      clientRevision: session.governanceRevision ?? 0,
    } as ReviewCommandRequest);

  const isPending = (itemKind: "context_entry" | "faq", itemId: string) =>
    pendingReviewItems.has(`${itemKind}:${itemId}`);

  const removeEntry = async (kind: "knowledge" | "faq", entry: BusinessContextEntry | GeneratedFaqEntry) => {
    const confirmed = await showConfirm({
      title: "Remove information?",
      message: "This information will be removed from the review list and will not be used by your assistant.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    await submit({ itemId: entry.id, itemKind: kind === "knowledge" ? "context_entry" : "faq", expectedCurrentState: entry.status, kind: entry.status === "proposed" ? "reject" : "archive" });
  };

  const approveAll = async () => {
    // Commands remain item-scoped. This preserves the existing bulk UX while
    // ensuring every persisted decision has its own auditable command.
    setBulkFailureMessage(null);
    const decisions = [...contextEntries, ...faqEntries].filter((entry) => entry.status === "proposed");
    const outcomes: PromiseSettledResult<void>[] = [];
    // Keep requests ordered so each request uses the latest authoritative
    // revision cached by the command client. A failure does not block later
    // decisions; successful commands stay committed independently.
    for (const entry of decisions) {
      outcomes.push(await Promise.resolve(submit({ itemId: entry.id, itemKind: "category" in entry ? "context_entry" : "faq", expectedCurrentState: entry.status, kind: "approve" })).then(() => ({ status: "fulfilled", value: undefined } as const), (reason) => ({ status: "rejected", reason } as const)));
    }
    const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
    if (failed) setBulkFailureMessage(`${failed} item${failed === 1 ? "" : "s"} could not be approved. Review and retry those items.`);
  };

  const canLaunchChat =
    session.status === "ready" && session.contextCounts.approved > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {confirmDialogNode}
      {bulkFailureMessage ? <p className="mx-auto max-w-5xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200" role="alert">{bulkFailureMessage}</p> : null}
      <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#030713] px-5 py-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)] sm:px-8 sm:py-10">
        <AiBuilderAuthCta />
        <div className="pointer-events-none absolute inset-x-0 top-[-8rem] mx-auto h-56 max-w-3xl rounded-full bg-amber-400/10 blur-[90px]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 sm:text-sm">
            Your AI is ready
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Review what your <span className="text-amber-300">AI learned.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            Approve, correct, or remove anything before it becomes trusted
            business knowledge.
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

          <div className="mx-auto mt-7 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={session.contextCounts.total} />
            <Stat label="Approved" value={session.contextCounts.approved} />
            <Stat label="Pending" value={session.contextCounts.proposed} />
            <Stat label="Removed" value={session.contextCounts.archived} />
          </div>
          <div className="mx-auto mt-5 flex flex-wrap justify-center gap-2" aria-label="Review filter">
            {(["all", "proposed", "approved", "archived"] as const).map((nextFilter) => (
              <button key={nextFilter} type="button" onClick={() => setFilter(nextFilter)} className={secondaryButtonClassName} aria-pressed={filter === nextFilter}>
                {nextFilter === "all" ? "All" : nextFilter === "archived" ? "Removed" : nextFilter === "proposed" ? "Pending" : "Approved"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {grouped.length ? <section className="mx-auto max-w-5xl space-y-7 rounded-[30px] border border-white/[0.09] bg-[#030713] px-4 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:py-10">
        <SectionHeading
          eyebrow="Business knowledge"
          title={<>Review every <span className="text-amber-300">important business fact.</span></>}
          description="Each item can be approved, corrected, or removed before your assistant uses it."
        />

        {grouped.map(([sectionKey, section]) => (
          <section key={sectionKey} className="mx-auto max-w-4xl">
            <div className="mx-auto grid max-w-3xl gap-3 md:grid-cols-2">
              {section.entries.map(({ entry }, index) => {
                const entryRenderKey = `context_entry:${entry.id}`;
                const editing = editingEntry === entryRenderKey;
                const pending = isPending("context_entry", entry.id);
                const shouldSpanFull =
                  section.entries.length === 1 ||
                  (section.entries.length % 2 === 1 &&
                    index === section.entries.length - 1);

                return (
                  <article
                    key={entryRenderKey}
                    onClick={() => setSelectedItem(entryRenderKey)}
                    className={`flex min-h-[190px] flex-col items-center justify-center rounded-[20px] border border-amber-300/25 bg-black/15 px-4 py-5 text-center ${
                      shouldSpanFull ? "md:col-span-2" : ""
                    }`}
                  >
                    <p className="mb-3 text-xl font-bold text-amber-300 sm:text-2xl">
                      {section.label}
                    </p>

                    {editing ? (
                      <div className="w-full max-w-2xl space-y-3">
                        <input
                          value={entryDrafts[entryRenderKey]?.title ?? entry.title}
                          onChange={(event) => setEntryDrafts((drafts) => ({ ...drafts, [entryRenderKey]: { ...(drafts[entryRenderKey] ?? { title: entry.title, content: entry.content }), title: event.target.value } }))}
                          className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
                        />

                        <textarea
                          rows={4}
                          value={entryDrafts[entryRenderKey]?.content ?? entry.content}
                          onChange={(event) => setEntryDrafts((drafts) => ({ ...drafts, [entryRenderKey]: { ...(drafts[entryRenderKey] ?? { title: entry.title, content: entry.content }), content: event.target.value } }))}
                          className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                          {entry.content}
                        </p>
                      </>
                    )}

                    <div className="mt-auto flex flex-wrap justify-center gap-2 pt-5">
                      {entry.status === "proposed" ? <button
                        type="button"
                        onClick={() => void submit({ itemId: entry.id, itemKind: "context_entry", expectedCurrentState: entry.status, kind: "approve" })}
                        className={approveActionClassName}
                        disabled={pending}
                      >
                        Approve
                      </button> : null}

                      {entry.status === "archived" ? <button
                        type="button"
                        onClick={() => void submit({ itemId: entry.id, itemKind: "context_entry", expectedCurrentState: entry.status, kind: "restore" })}
                        className={approveActionClassName}
                        disabled={pending}
                      >
                        Restore
                      </button> : null}

                      {entry.status !== "archived" ? <button
                        type="button"
                        onClick={() => {
                          if (editing) {
                            const draft = entryDrafts[entryRenderKey];
                            if (!draft || (draft.title === entry.title && draft.content === entry.content)) { setEditingEntry(null); return; }
                            void submit({ itemId: entry.id, itemKind: "context_entry", expectedCurrentState: entry.status, kind: "correct", correction: { itemKind: "context_entry", title: draft.title, content: draft.content, category: entry.category } }).then(() => setEditingEntry(null)).catch(() => undefined);
                          } else setEditingEntry(entryRenderKey);
                        }}
                        className={itemActionClassName}
                        disabled={pending}
                      >
                        {editing ? "Done" : "Edit"}
                      </button> : null}

                      {entry.status !== "archived" ? <button
                        type="button"
                        onClick={() =>
                          void removeEntry("knowledge", entry)
                        }
                        className={itemActionClassName}
                        disabled={pending}
                      >
                        Remove Information
                      </button> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </section> : null}

      {visibleFaqEntries.length ? <section className="mx-auto max-w-5xl space-y-7 rounded-[30px] border border-white/[0.09] bg-[#030713] px-4 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:py-10">
        <SectionHeading
          eyebrow="Generated Q&A"
          title={<>Questions your <span className="text-amber-300">AI is ready</span> to answer.</>}
          description="Review the generated answers before they become part of the live assistant."
        />

        <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
          {visibleFaqEntries.map(({ faq }, index) => {
            const faqRenderKey = `faq:${faq.id}`;
            const editing = editingFaq === faqRenderKey;
            const pending = isPending("faq", faq.id);
            const shouldSpanFull =
              visibleFaqEntries.length === 1 ||
              (visibleFaqEntries.length % 2 === 1 &&
                index === visibleFaqEntries.length - 1);

            return (
              <article
                key={faqRenderKey}
                onClick={() => setSelectedItem(faqRenderKey)}
                className={`flex min-h-[210px] flex-col items-center justify-center rounded-[22px] border border-amber-300/25 bg-[#030713] px-5 py-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)] ${
                  shouldSpanFull ? "md:col-span-2" : ""
                }`}
              >
                {editing ? (
                  <div className="w-full max-w-2xl space-y-3">
                    <input
                      value={faqDrafts[faqRenderKey]?.question ?? faq.question}
                      onChange={(event) => setFaqDrafts((drafts) => ({ ...drafts, [faqRenderKey]: { ...(drafts[faqRenderKey] ?? { question: faq.question, answer: faq.answer }), question: event.target.value } }))}
                      className="w-full rounded-2xl border border-white/10 bg-[#020611] px-4 py-3 text-center text-white outline-none focus:border-amber-300/50"
                    />

                    <textarea
                      rows={4}
                      value={faqDrafts[faqRenderKey]?.answer ?? faq.answer}
                      onChange={(event) => setFaqDrafts((drafts) => ({ ...drafts, [faqRenderKey]: { ...(drafts[faqRenderKey] ?? { question: faq.question, answer: faq.answer }), answer: event.target.value } }))}
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
                  {faq.status === "proposed" ? <button
                    type="button"
                    onClick={() => void submit({ itemId: faq.id, itemKind: "faq", expectedCurrentState: faq.status, kind: "approve" })}
                    className={approveActionClassName}
                    disabled={pending}
                  >
                    Approve
                  </button> : null}

                  {faq.status === "archived" ? <button
                    type="button"
                    onClick={() => void submit({ itemId: faq.id, itemKind: "faq", expectedCurrentState: faq.status, kind: "restore" })}
                    className={approveActionClassName}
                    disabled={pending}
                  >
                    Restore
                  </button> : null}

                  {faq.status !== "archived" ? <button
                    type="button"
                    onClick={() => {
                      if (editing) {
                        const draft = faqDrafts[faqRenderKey];
                        if (!draft || (draft.question === faq.question && draft.answer === faq.answer)) { setEditingFaq(null); return; }
                        void submit({ itemId: faq.id, itemKind: "faq", expectedCurrentState: faq.status, kind: "correct", correction: { itemKind: "faq", question: draft.question, answer: draft.answer } }).then(() => setEditingFaq(null)).catch(() => undefined);
                      } else setEditingFaq(faqRenderKey);
                    }}
                    className={itemActionClassName}
                    disabled={pending}
                  >
                    {editing ? "Done" : "Edit"}
                  </button> : null}

                  {faq.status !== "archived" ? <button
                    type="button"
                    onClick={() => void removeEntry("faq", faq)}
                    className={itemActionClassName}
                    disabled={pending}
                  >
                    Remove Information
                  </button> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section> : null}

      {!grouped.length && !visibleFaqEntries.length ? (
        <section className="mx-auto max-w-3xl rounded-[24px] border border-white/[0.09] bg-[#030713] px-5 py-10 text-center shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
          <p className="text-lg font-semibold text-white">No knowledge matches this review filter.</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Choose another status to continue reviewing business knowledge.</p>
        </section>
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
    <div className="rounded-2xl border border-amber-300/25 bg-[#030713] px-3 py-4 text-center shadow-[0_14px_44px_rgba(0,0,0,0.18)] sm:px-5">
      <div className="text-2xl font-semibold text-amber-300 sm:text-3xl">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">
        {label}
      </div>
    </div>
  );
}
