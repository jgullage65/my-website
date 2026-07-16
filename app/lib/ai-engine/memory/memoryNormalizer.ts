/**
 * Memory Normalizer
 *
 * Purpose:
 * Provides deterministic text, array, date, and object normalization helpers.
 */

import type {
    BusinessContextEntry,
    DemoThreadMemory,
  } from "@/app/lib/ai-engine/contracts";
  
  export function normalizeMemoryText(value: unknown): string {
    return String(value ?? "")
      .replace(/\u0000/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  export function normalizeOptionalMemoryText(
    value: unknown,
  ): string | null {
    const normalized = normalizeMemoryText(value);
    return normalized || null;
  }
  
  export function normalizeMemoryArray(
    values: unknown,
    limit = 12,
  ): string[] {
    if (!Array.isArray(values)) return [];
  
    const seen = new Set<string>();
    const result: string[] = [];
  
    values.forEach((value) => {
      const normalized = normalizeMemoryText(value);
      const key = normalized.toLowerCase();
  
      if (!normalized || seen.has(key) || result.length >= limit) return;
  
      seen.add(key);
      result.push(normalized);
    });
  
    return result;
  }
  
  export function normalizeIsoDate(
    value?: string | Date | null,
  ): string {
    if (!value) return new Date().toISOString();
  
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
  }
  
  export function normalizeStickyState(
    value: unknown,
  ): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
  
    return { ...(value as Record<string, unknown>) };
  }
  
  export function normalizeBusinessContextEntry(
    entry: BusinessContextEntry,
  ): BusinessContextEntry {
    return {
      ...entry,
      title: normalizeMemoryText(entry.title),
      content: normalizeMemoryText(entry.content),
      source: {
        ...entry.source,
        excerpt: normalizeMemoryText(entry.source.excerpt),
      },
      metadata: {
        ...entry.metadata,
        conflictingEntryIds: normalizeMemoryArray(
          entry.metadata.conflictingEntryIds,
          20,
        ),
        tags: normalizeMemoryArray(entry.metadata.tags, 20),
      },
      createdAt: normalizeIsoDate(entry.createdAt),
      updatedAt: normalizeIsoDate(entry.updatedAt),
    };
  }
  
  export function normalizeThreadMemory(
    memory: DemoThreadMemory,
  ): DemoThreadMemory {
    return {
      ...memory,
      primaryGoal: normalizeOptionalMemoryText(memory.primaryGoal),
      currentSubject: normalizeOptionalMemoryText(memory.currentSubject),
      selectedService: normalizeOptionalMemoryText(memory.selectedService),
      activeConstraints: normalizeMemoryArray(memory.activeConstraints, 12),
      collectedDetails: normalizeMemoryArray(memory.collectedDetails, 20),
      unresolvedQuestions: normalizeMemoryArray(
        memory.unresolvedQuestions,
        12,
      ),
      recentClarifications: normalizeMemoryArray(
        memory.recentClarifications,
        12,
      ),
      summary:
        normalizeMemoryText(memory.summary) || "Thread started.",
      stickyState: normalizeStickyState(memory.stickyState),
      lastUpdatedAt: normalizeIsoDate(memory.lastUpdatedAt),
    };
  }
  