/**
 * Business Memory
 *
 * Purpose:
 * Builds and merges permanent business knowledge.
 *
 * Rules:
 * - only approved, corrected, or archived entries are accepted
 * - proposed entries are never promoted automatically
 * - entries are merged by ID
 * - archived entries remain auditable
 */

import type {
    BusinessContextEntry,
    BusinessMemory,
  } from "@/app/lib/ai-engine/contracts";
  import type {
    BusinessMemoryMergeInput,
    BusinessMemoryMergeResult,
  } from "./contracts";
  import {
    normalizeBusinessContextEntry,
    normalizeIsoDate,
  } from "./memoryNormalizer";
  
  function isPersistableEntry(entry: BusinessContextEntry): boolean {
    return (
      entry.status === "approved" ||
      entry.status === "corrected" ||
      entry.status === "archived"
    );
  }
  
  function sortEntries(
    entries: BusinessContextEntry[],
  ): BusinessContextEntry[] {
    return entries.slice().sort((left, right) => {
      const leftArchived = left.status === "archived" ? 1 : 0;
      const rightArchived = right.status === "archived" ? 1 : 0;
  
      if (leftArchived !== rightArchived) {
        return leftArchived - rightArchived;
      }
  
      return (
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime()
      );
    });
  }
  
  export function buildBusinessMemory(params: {
    sessionId: string;
    entries: BusinessContextEntry[];
    updatedAt?: string;
  }): BusinessMemory {
    const normalizedEntries = params.entries
      .filter(isPersistableEntry)
      .map(normalizeBusinessContextEntry);
  
    const byId = new Map<string, BusinessContextEntry>();
  
    normalizedEntries.forEach((entry) => {
      byId.set(entry.id, entry);
    });
  
    return {
      sessionId: params.sessionId,
      entries: sortEntries(Array.from(byId.values())),
      version: 1,
      updatedAt: normalizeIsoDate(params.updatedAt),
    };
  }
  
  export function mergeBusinessMemory(
    input: BusinessMemoryMergeInput,
  ): BusinessMemoryMergeResult {
    const current =
      input.current ??
      buildBusinessMemory({
        sessionId: input.sessionId,
        entries: [],
        updatedAt: input.updatedAt,
      });
  
    const nextById = new Map<string, BusinessContextEntry>();
  
    current.entries.forEach((entry) => {
      nextById.set(entry.id, normalizeBusinessContextEntry(entry));
    });
  
    const addedEntryIds: string[] = [];
    const updatedEntryIds: string[] = [];
    const archivedEntryIds: string[] = [];
    const skippedEntryIds: string[] = [];
  
    input.incoming.forEach((rawEntry) => {
      const entry = normalizeBusinessContextEntry(rawEntry);
  
      if (!isPersistableEntry(entry)) {
        skippedEntryIds.push(entry.id);
        return;
      }
  
      const existing = nextById.get(entry.id);
  
      if (!existing) {
        nextById.set(entry.id, entry);
        addedEntryIds.push(entry.id);
  
        if (entry.status === "archived") {
          archivedEntryIds.push(entry.id);
        }
  
        return;
      }
  
      const changed =
        JSON.stringify(existing) !== JSON.stringify(entry);
  
      if (!changed) {
        skippedEntryIds.push(entry.id);
        return;
      }
  
      nextById.set(entry.id, entry);
      updatedEntryIds.push(entry.id);
  
      if (
        entry.status === "archived" &&
        existing.status !== "archived"
      ) {
        archivedEntryIds.push(entry.id);
      }
    });
  
    const changed =
      addedEntryIds.length > 0 ||
      updatedEntryIds.length > 0 ||
      archivedEntryIds.length > 0;
  
    return {
      memory: {
        sessionId: input.sessionId,
        entries: sortEntries(Array.from(nextById.values())),
        version: changed ? current.version + 1 : current.version,
        updatedAt: changed
          ? normalizeIsoDate(input.updatedAt)
          : current.updatedAt,
      },
      addedEntryIds,
      updatedEntryIds,
      archivedEntryIds,
      skippedEntryIds,
      changed,
    };
  }
  
  export function getActiveBusinessMemoryEntries(
    memory: BusinessMemory,
  ): BusinessContextEntry[] {
    return memory.entries.filter(
      (entry) =>
        entry.status === "approved" ||
        entry.status === "corrected",
    );
  }
  