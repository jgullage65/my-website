/**
 * Intake Normalizer
 *
 * Purpose:
 * Provides deterministic text, confidence, ID, and deduplication helpers.
 *
 * Never:
 * - calls a model
 * - writes memory
 * - detects semantic conflicts
 */

import type { ContextConfidence } from "@/lib/ai-engine/contracts";

export function normalizeIntakeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeInlineText(value: unknown): string {
  return normalizeIntakeText(value).replace(/\s+/g, " ").trim();
}

export function normalizeComparableText(value: unknown): string {
  return normalizeInlineText(value)
    .toLowerCase()
    .replace(/[“”"'`]/g, "")
    .replace(/[^a-z0-9$%./:\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampConfidenceScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
}

export function confidenceFromScore(score: number): ContextConfidence {
  if (score >= 0.82) return "high";
  if (score >= 0.58) return "medium";
  return "low";
}

export function normalizeConfidence(
  value: unknown,
  fallbackScore = 0,
): ContextConfidence {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return confidenceFromScore(clampConfidenceScore(fallbackScore));
}

export function stableIntakeId(seed: string, prefix = "intake"): string {
  const source = String(seed ?? "");
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

export function uniqueStrings(
  values: unknown[],
  limit = Number.POSITIVE_INFINITY,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeInlineText(value);
    const key = normalizeComparableText(normalized);

    if (!normalized || !key || seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);

    if (result.length >= limit) break;
  }

  return result;
}

export function sourceExcerptExists(
  sourceContent: string,
  excerpt: string,
): boolean {
  const source = normalizeComparableText(sourceContent);
  const candidate = normalizeComparableText(excerpt);

  if (!source || !candidate) return false;
  if (source.includes(candidate)) return true;

  const tokens = candidate.split(" ").filter((token) => token.length > 2);
  if (tokens.length < 4) return false;

  const matched = tokens.filter((token) => source.includes(token)).length;
  return matched / tokens.length >= 0.8;
}

export function dedupeByKey<T>(
  values: T[],
  buildKey: (value: T) => string,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = normalizeComparableText(buildKey(value));
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
}
