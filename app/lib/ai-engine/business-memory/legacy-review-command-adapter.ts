import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { ReviewCommand, ReviewCommandActor, ReviewCommandKind } from "./review-commands";

export class UnsupportedLegacyReviewMutationError extends Error {
  constructor(readonly itemKind: "context_entry" | "faq", readonly itemId: string) {
    super(`unsupported_legacy_review_mutation:${itemKind}:${itemId}`);
  }
}

/**
 * Compatibility-only translation for the pre-command review screen.  This is
 * deliberately a pure operation: it describes intents but never persists a
 * review item, history record, or project revision.  The caller must pass the
 * resulting commands to the validator and canonical executor.
 */
export function commandsFromLegacyReviewSession(
  before: AiBuilderSession,
  after: AiBuilderSession,
  actor: ReviewCommandActor,
): ReviewCommand[] {
  const commands: ReviewCommand[] = [];
  const revision = Number(before.governanceRevision ?? 0);
  const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? "undefined";
  };
  const unchangedOutsideCommand = (current: Record<string, unknown>, next: Record<string, unknown>, allowed: readonly string[]) => {
    const omit = new Set(["status", ...allowed]);
    const remaining = (item: Record<string, unknown>) => Object.fromEntries(Object.entries(item).filter(([key]) => !omit.has(key)));
    return canonicalJson(remaining(current)) === canonicalJson(remaining(next));
  };
  const add = (
    itemKind: "context_entry" | "faq",
    previous: AiBuilderSession["contextEntries"][number] | AiBuilderSession["faqEntries"][number],
    next: AiBuilderSession["contextEntries"][number] | AiBuilderSession["faqEntries"][number],
    kind: ReviewCommandKind,
  ) => {
    const commandId = legacyCommandId(before.id, itemKind, previous.id, revision, kind, next);
    const base = {
      commandId, projectId: before.id, itemId: previous.id, itemKind, actor,
      clientRevision: revision + commands.length, expectedCurrentState: previous.status,
      requestedTransition: { from: previous.status, to: next.status }, createdAt: next.updatedAt,
    } as const;
    if (kind === "correct") {
      commands.push((itemKind === "context_entry"
        ? { ...base, kind, correction: { itemKind, content: (next as AiBuilderSession["contextEntries"][number]).content, category: (next as AiBuilderSession["contextEntries"][number]).category, title: (next as AiBuilderSession["contextEntries"][number]).title } }
        : { ...base, kind, correction: { itemKind, question: (next as AiBuilderSession["faqEntries"][number]).question, answer: (next as AiBuilderSession["faqEntries"][number]).answer } }) as ReviewCommand);
    } else commands.push({ ...base, kind } as never);
  };
  const translate = (itemKind: "context_entry" | "faq", prior: readonly any[], submitted: readonly any[]) => {
    const previous = new Map(prior.map((item) => [item.id, item]));
    const submittedIds = new Set(submitted.map((item) => item.id));
    for (const current of prior) {
      if (!submittedIds.has(current.id)) throw new UnsupportedLegacyReviewMutationError(itemKind, current.id);
    }
    for (const next of submitted) {
      const current = previous.get(next.id);
      if (!current) throw new UnsupportedLegacyReviewMutationError(itemKind, next.id);
      const contentChanged = itemKind === "context_entry"
        ? current.category !== next.category || current.title !== next.title || current.content !== next.content
        : current.question !== next.question || current.answer !== next.answer;
      if (current.status === next.status && !contentChanged) {
        if (!unchangedOutsideCommand(current, next, [])) throw new UnsupportedLegacyReviewMutationError(itemKind, next.id);
        continue;
      }
      const transition = `${current.status}:${next.status}`;
      const kind: ReviewCommandKind | undefined = transition === "proposed:approved" ? "approve"
        : transition === "proposed:corrected" ? "correct"
        : transition === "proposed:archived" ? "reject"
        : transition === "approved:archived" || transition === "corrected:archived" ? "archive"
        : transition === "approved:proposed" ? "unapprove"
        : transition === "archived:approved" ? "restore" : undefined;
      const correctableFields = itemKind === "context_entry" ? ["category", "title", "content"] : ["question", "answer"];
      if (!kind || (kind !== "correct" && contentChanged) || !unchangedOutsideCommand(current, next, kind === "correct" ? correctableFields : [])) {
        throw new UnsupportedLegacyReviewMutationError(itemKind, next.id);
      }
      add(itemKind, current, next, kind);
    }
  };
  translate("context_entry", before.contextEntries, after.contextEntries);
  translate("faq", before.faqEntries, after.faqEntries);
  return commands;
}

function legacyCommandId(projectId: string, itemKind: string, itemId: string, revision: number, kind: string, payload: unknown): string {
  // Stable across a browser retry, without treating the submitted snapshot as
  // authority. The executor's durable command ledger supplies idempotency.
  const value = JSON.stringify(payload);
  let hash = 2166136261;
  for (const char of `${projectId}\u0000${itemKind}\u0000${itemId}\u0000${revision}\u0000${kind}\u0000${value}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `legacy-review-${(hash >>> 0).toString(36)}`;
}
