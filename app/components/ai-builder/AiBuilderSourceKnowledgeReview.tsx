"use client";

import { useMemo, useState } from "react";
import type { BusinessContextEntry } from "@/app/lib/ai-engine/contracts";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

type Filter = "all" | "approved" | "proposed" | "archived";

type Props = {
  sourceUrl: string;
};

const normalizeUrl = (value: string | null | undefined) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch {
    return value.trim();
  }
};

const label = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AiBuilderSourceKnowledgeReview({ sourceUrl }: Props) {
  const { session, pendingReviewItems, submitReviewCommand } = useAiBuilderWorkspace();
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; content: string }>>({});
  const normalizedSourceUrl = normalizeUrl(sourceUrl);

  const entries = useMemo(
    () =>
      session.contextEntries.filter(
        (entry) =>
          entry.source.sourceType === "website" &&
          normalizeUrl(entry.source.sourceUrl) === normalizedSourceUrl,
      ),
    [normalizedSourceUrl, session.contextEntries],
  );

  const counts = useMemo(
    () => ({
      total: entries.length,
      approved: entries.filter((entry) => entry.status === "approved" || entry.status === "corrected").length,
      proposed: entries.filter((entry) => entry.status === "proposed").length,
      archived: entries.filter((entry) => entry.status === "archived").length,
    }),
    [entries],
  );

  const visible = entries.filter((entry) => {
    if (filter === "all") return entry.status !== "archived";
    if (filter === "approved") return entry.status === "approved" || entry.status === "corrected";
    return entry.status === filter;
  });

  const submit = (entry: BusinessContextEntry, request: Record<string, unknown>) =>
    submitReviewCommand({
      commandId: crypto.randomUUID(),
      projectId: session.id,
      clientRevision: session.governanceRevision ?? 0,
      itemKind: "context_entry",
      itemId: entry.id,
      expectedCurrentState: entry.status,
      ...request,
    } as Parameters<typeof submitReviewCommand>[0]);

  const approve = (entry: BusinessContextEntry) =>
    submit(entry, { kind: "approve" });

  const restore = (entry: BusinessContextEntry) =>
    submit(entry, { kind: "restore" });

  const remove = async (entry: BusinessContextEntry) => {
    const confirmed = await showConfirm({
      title: "Remove information?",
      message:
        "This information will be removed from the active review list and will not be used by your assistant. You can restore it from Removed later.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    await submit(entry, { kind: entry.status === "proposed" ? "reject" : "archive" });
  };

  const beginEdit = (entry: BusinessContextEntry) => {
    setDrafts((current) => ({
      ...current,
      [entry.id]: { title: entry.title, content: entry.content },
    }));
    setEditingId(entry.id);
  };

  const saveEdit = async (entry: BusinessContextEntry) => {
    const draft = drafts[entry.id];
    if (!draft?.title.trim() || !draft.content.trim()) return;
    await submit(entry, {
      kind: "correct",
      correction: { title: draft.title.trim(), content: draft.content.trim() },
    });
    setEditingId(null);
  };

  const filters: Array<{ key: Filter; label: string; value: number }> = [
    { key: "all", label: "All", value: counts.total },
    { key: "approved", label: "Approved", value: counts.approved },
    { key: "proposed", label: "Pending", value: counts.proposed },
    { key: "archived", label: "Removed", value: counts.archived },
  ];

  return (
    <div className="space-y-5">
      {confirmDialogNode}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-xl border px-3 py-4 text-center transition ${
              filter === item.key
                ? "border-white/[.16] bg-[#141414]"
                : "border-white/[.08] bg-[#080808] hover:border-white/[.14]"
            }`}
          >
            <span className="block text-xl font-semibold text-white">{item.value}</span>
            <span className="mt-1 block text-[.64rem] font-bold uppercase tracking-[.14em] text-slate-500">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((entry) => {
          const pending = pendingReviewItems.has(`context_entry:${entry.id}`);
          const editing = editingId === entry.id;
          const draft = drafts[entry.id] ?? { title: entry.title, content: entry.content };

          return (
            <article
              key={entry.id}
              className="rounded-[14px] border border-white/[.08] bg-[#080808]/95 p-4 shadow-[0_14px_36px_rgba(0,0,0,.2)]"
            >
              {editing ? (
                <div className="space-y-3">
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [entry.id]: { ...draft, title: event.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-white/[.1] bg-black px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-white/25"
                  />
                  <textarea
                    value={draft.content}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [entry.id]: { ...draft, content: event.target.value },
                      }))
                    }
                    rows={5}
                    className="w-full resize-y rounded-lg border border-white/[.1] bg-black px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none focus:border-white/25"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-white/[.1] bg-black px-3 py-2.5 text-xs font-semibold text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void saveEdit(entry)}
                      className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-[.64rem] font-bold uppercase tracking-[.14em] text-slate-500">
                      {label(entry.category)}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-white">{entry.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{entry.content}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <span className="rounded-lg border border-white/[.08] bg-black px-2.5 py-1 text-[.65rem] font-semibold text-slate-400">
                        {label(entry.status)}
                      </span>
                      <span className="rounded-lg border border-white/[.08] bg-black px-2.5 py-1 text-[.65rem] font-semibold text-slate-400">
                        {label(entry.confidence)} confidence
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {entry.status === "archived" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void restore(entry)}
                        className="cta-raised col-span-2 rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40 sm:col-span-3"
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={pending || entry.status !== "proposed"}
                          onClick={() => void approve(entry)}
                          className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-35"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => beginEdit(entry)}
                          className="cta-raised rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-35"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void remove(entry)}
                          className="cta-raised col-span-2 rounded-lg border border-amber-300/20 bg-black px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-35 sm:col-span-1"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </article>
          );
        })}

        {!visible.length ? (
          <div className="rounded-xl border border-white/[.08] bg-[#080808] px-5 py-10 text-center text-sm text-slate-500">
            No knowledge entries match this filter.
          </div>
        ) : null}
      </div>
    </div>
  );
}
