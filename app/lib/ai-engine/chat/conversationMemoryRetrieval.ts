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
const factualMemoryCategories = new Set<ConversationMemoryContextItem["category"]>(["decision", "clarification", "summary", "current_task"]);
const factualTerms = (value: string) => new Set(Array.from(words(value), word => word.endsWith("ies") ? `${word.slice(0, -3)}y` : word.endsWith("s") ? word.slice(0, -1) : word));
const sharesFactualSubject = (left: string, right: string) => Array.from(factualTerms(left)).some(term => factualTerms(right).has(term));
type FactualPolarity = "available" | "unavailable" | "open" | "closed" | "included" | "extra_cost";
const factualPolarities = (value: string) => {
  const normalized = value.toLowerCase();
  const polarities = new Set<FactualPolarity>();
  const unavailable = /\b(?:do not|don't|does not|doesn't|no)\s+(?:offer|provide|have|allow)\b|\b(?:not available|unavailable)\b/.test(normalized);
  const extraCost = /\b(?:costs?|charges?|priced?)\s+(?:extra|additional)\b|\b(?:extra|additional)\s+(?:cost|charge|fee)\b|\bnot included\b/.test(normalized);
  if (unavailable) polarities.add("unavailable");
  else if (/\b(?:available|offer|offers|offered|provide|provides|provided|allow|allows|allowed)\b/.test(normalized)) polarities.add("available");
  if (/\bclosed\b/.test(normalized)) polarities.add("closed");
  if (/\bopen\b/.test(normalized)) polarities.add("open");
  if (extraCost) polarities.add("extra_cost");
  else if (/\bincluded\b|\bat no additional cost\b/.test(normalized)) polarities.add("included");
  return polarities;
};
const oppositePolarity: Record<FactualPolarity, FactualPolarity> = { available: "unavailable", unavailable: "available", open: "closed", closed: "open", included: "extra_cost", extra_cost: "included" };
const hasNonnumericFactualConflict = (memory: ConversationMemoryContextItem, fact: string) => {
  if (!factualMemoryCategories.has(memory.category) || !sharesFactualSubject(memory.content, fact)) return false;
  const remembered = factualPolarities(memory.content), canonical = factualPolarities(fact);
  return Array.from(remembered).some(polarity => canonical.has(oppositePolarity[polarity]));
};

/** Remove only concrete contradictory remembered assertions; factual authority remains canonical. */
export function excludeConflictingConversationMemory(items: ConversationMemoryContextItem[], retrieved: StructuredCanonicalRetrievalResult): { items: ConversationMemoryContextItem[]; excludedConflict: boolean } {
  const facts = businessValues(retrieved);
  let excludedConflict = false;
  const kept = items.filter(item => {
    const rememberedNumbers = numbers(item.content);
    const numericConflict = rememberedNumbers.length > 0 && facts.some(fact => {
      const factNumbers = numbers(fact);
      return factNumbers.length > 0 && rememberedNumbers.some(number => !factNumbers.includes(number)) && Array.from(words(item.content)).some(word => words(fact).has(word));
    });
    // Conservative, deterministic polarity pairs require a shared factual subject.
    // Preferences, goals, and questions remain continuity context rather than facts.
    const nonnumericConflict = facts.some(fact => hasNonnumericFactualConflict(item, fact));
    const conflict = numericConflict || nonnumericConflict;
    excludedConflict ||= conflict;
    return !conflict;
  });
  return { items: kept, excludedConflict };
}
