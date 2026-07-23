import type { CanonicalConversationMemory } from "../memory/conversationMemory";
import type { StructuredCanonicalRetrievalResult } from "./structuredCanonicalRetrieval";

/** Bounded, non-authoritative context selected from one already-owned thread. */
export type ConversationMemoryContextItem = {
  category: "summary" | "goal" | "current_task" | "preference" | "decision" | "unresolved_question" | "clarification";
  content: string;
};
export type ConversationMemoryRetrievalResult = {
  source: "conversation_memory";
  authority: "contextual";
  items: ConversationMemoryContextItem[];
  diagnostics: { retrievalDurationMs: number; selectedCategories: string[] };
};

const limit = 8;
const words = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
const score = (value: string, query: Set<string>) => Array.from(words(value)).reduce((total, word) => total + (query.has(word) ? 1 : 0), 0);
const clean = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 500);

/**
 * Selects thread context deterministically. It never reads messages, mutates
 * memory, or treats memory as business knowledge.
 */
export function retrieveRelevantConversationMemory(memory: CanonicalConversationMemory, message: string): ConversationMemoryRetrievalResult {
  const startedAt = Date.now();
  const candidates: ConversationMemoryContextItem[] = [];
  const add = (category: ConversationMemoryContextItem["category"], content: string | null | undefined) => {
    const normalized = clean(content ?? "");
    if (normalized && normalized !== "Thread not started.") candidates.push({ category, content: normalized });
  };
  add("goal", memory.primaryGoal);
  add("current_task", memory.currentSubject);
  add("current_task", memory.selectedService);
  memory.temporaryContext.forEach(value => add("current_task", value));
  memory.userPreferences.forEach(value => add("preference", `${value.key}: ${value.value}`));
  memory.conversationDetails.forEach(value => add("decision", `${value.key}: ${value.value}`));
  memory.unresolvedFollowUps.filter(value => value.status === "open").forEach(value => add("unresolved_question", value.question));
  memory.recentClarifications.forEach(value => add("clarification", value));
  add("summary", memory.summary);
  const query = words(message);
  const ranked = candidates
    .map((item, index) => ({ item, index, score: score(item.content, query) }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index || a.item.content.localeCompare(b.item.content))
    .slice(0, limit);
  // Continuation requests are relevant to the current task even without a
  // repeated keyword; still keep the same deterministic bounded ordering.
  const continuation = /\b(continue|next|resume|progress|status|prefer)\b/i.test(message);
  const items = (ranked.length ? ranked : continuation ? candidates.map((item, index) => ({ item, index, score: 0 })).filter(candidate => candidate.item.category !== "summary").slice(0, limit) : []).map(candidate => candidate.item);
  return { source: "conversation_memory", authority: "contextual", items, diagnostics: { retrievalDurationMs: Date.now() - startedAt, selectedCategories: Array.from(new Set(items.map(item => item.category))) } };
}

const businessValues = (retrieved: StructuredCanonicalRetrievalResult) => retrieved.items.flatMap(item => {
  if ("value" in item.item) return [`${item.item.title} ${item.item.value}`.toLowerCase()];
  if ("instruction" in item.item) return [item.item.instruction.toLowerCase()];
  return [];
});
const numbers = (value: string): string[] => value.match(/(?:\$|£|€)?\d+(?:\.\d+)?%?/g) ?? [];

/** Remove only concrete contradictory remembered assertions; factual authority remains canonical. */
export function excludeConflictingConversationMemory(items: ConversationMemoryContextItem[], retrieved: StructuredCanonicalRetrievalResult): { items: ConversationMemoryContextItem[]; excludedConflict: boolean } {
  const facts = businessValues(retrieved);
  let excludedConflict = false;
  const kept = items.filter(item => {
    const rememberedNumbers = numbers(item.content);
    if (!rememberedNumbers.length) return true;
    const conflict = facts.some(fact => {
      const factNumbers = numbers(fact);
      return factNumbers.length > 0 && rememberedNumbers.some(number => !factNumbers.includes(number)) && Array.from(words(item.content)).some(word => words(fact).has(word));
    });
    excludedConflict ||= conflict;
    return !conflict;
  });
  return { items: kept, excludedConflict };
}
