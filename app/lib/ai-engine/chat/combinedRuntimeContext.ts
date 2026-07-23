import type { CanonicalConversationMemory } from "../memory/conversationMemory";
import type { StructuredCanonicalRetrievalResult } from "./structuredCanonicalRetrieval";
import { excludeConflictingConversationMemory, retrieveRelevantConversationMemory, type ConversationMemoryContextItem } from "./conversationMemoryRetrieval";

export type CombinedRuntimeContext = {
  assistantProjection: { source: "assistant_projection"; authority: "authoritative"; retrieval: StructuredCanonicalRetrievalResult };
  conversationMemory: { source: "conversation_memory"; authority: "contextual"; items: ConversationMemoryContextItem[]; available: boolean; excludedConflict: boolean; retrievalDurationMs: number; selectedCategories: string[] };
};

/** Combines separately-classed sources without creating a combined fact list. */
export function buildCombinedRuntimeContext(retrieval: StructuredCanonicalRetrievalResult, memory: CanonicalConversationMemory | null, message: string): CombinedRuntimeContext {
  if (!memory) return { assistantProjection: { source: "assistant_projection", authority: "authoritative", retrieval }, conversationMemory: { source: "conversation_memory", authority: "contextual", items: [], available: false, excludedConflict: false, retrievalDurationMs: 0, selectedCategories: [] } };
  const selected = retrieveRelevantConversationMemory(memory, message);
  const filtered = excludeConflictingConversationMemory(selected.items, retrieval);
  return { assistantProjection: { source: "assistant_projection", authority: "authoritative", retrieval }, conversationMemory: { source: "conversation_memory", authority: "contextual", items: filtered.items, available: true, excludedConflict: filtered.excludedConflict, retrievalDurationMs: selected.diagnostics.retrievalDurationMs, selectedCategories: Array.from(new Set(filtered.items.map(item => item.category))) } };
}
