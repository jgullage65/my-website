import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { ReviewCommand, ReviewCommandActor, ReviewCommandKind } from "./review-commands";

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
    for (const next of submitted) {
      const current = previous.get(next.id);
      if (!current || (current.status === next.status && JSON.stringify(current) === JSON.stringify(next))) continue;
      const transition = `${current.status}:${next.status}`;
      const kind: ReviewCommandKind | undefined = transition === "proposed:approved" ? "approve"
        : transition === "proposed:corrected" ? "correct"
        : transition === "proposed:archived" ? "reject"
        : transition === "approved:archived" || transition === "corrected:archived" ? "archive"
        : transition === "approved:proposed" ? "unapprove"
        : transition === "archived:approved" ? "restore" : undefined;
      // Unsupported legacy edits are intentionally not turned into implicit
      // mutations. Validation/execution remains the sole governance boundary.
      if (kind) add(itemKind, current, next, kind);
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
