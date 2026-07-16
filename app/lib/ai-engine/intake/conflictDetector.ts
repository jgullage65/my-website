/**
 * Intake Conflict Detector
 *
 * Purpose:
 * Detects deterministic duplicate and contradiction candidates after
 * extraction. It does not decide which statement is correct.
 */

import type { BusinessContextCategory } from "@/app/lib/ai-engine/contracts";
import type {
  ConflictKind,
  DetectedIntakeConflict,
  ExtractedBusinessFact,
} from "./contracts";
import {
  normalizeComparableText,
  normalizeInlineText,
  stableIntakeId,
} from "./normalizer";

function categoryConflictKind(
  category: BusinessContextCategory,
  content: string,
): ConflictKind {
  const normalized = normalizeComparableText(content);

  if (category === "pricing" || /\$|price|cost|fee|minimum/.test(normalized)) {
    return "pricing";
  }

  if (category === "policy") return "policy";

  if (
    /\b(service area|serve|serving|located|city|state|region|nationwide)\b/.test(
      normalized,
    )
  ) {
    return "service_area";
  }

  if (/\b(hours|open|closed|monday|tuesday|weekend)\b/.test(normalized)) {
    return "hours";
  }

  if (
    category === "service" &&
    /\b(offer|do not offer|available|unavailable)\b/.test(normalized)
  ) {
    return "service_availability";
  }

  return "general";
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeComparableText(value)
      .split(" ")
      .filter((token) => token.length >= 3),
  );
}

function tokenSimilarity(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);

  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += 1;
  });

  return intersection / Math.min(left.size, right.size);
}

function extractNumbers(value: string): string[] {
  return normalizeComparableText(value).match(/\d+(?:\.\d+)?/g) ?? [];
}

function hasNegationMismatch(a: string, b: string): boolean {
  const negation = /\b(no|not|never|dont|doesnt|cannot|cant|unavailable)\b/;
  return negation.test(normalizeComparableText(a)) !==
    negation.test(normalizeComparableText(b));
}

function looksContradictory(
  first: ExtractedBusinessFact,
  second: ExtractedBusinessFact,
): boolean {
  if (first.category !== second.category) return false;

  const similarity = tokenSimilarity(first.content, second.content);
  if (similarity < 0.45) return false;

  if (hasNegationMismatch(first.content, second.content)) return true;

  const firstNumbers = extractNumbers(first.content);
  const secondNumbers = extractNumbers(second.content);

  if (
    firstNumbers.length > 0 &&
    secondNumbers.length > 0 &&
    firstNumbers.join(",") !== secondNumbers.join(",")
  ) {
    return true;
  }

  return false;
}

function buildQuestion(
  kind: ConflictKind,
  first: string,
  second: string,
): string {
  if (kind === "pricing") {
    return "Which pricing statement should the assistant treat as current and authoritative?";
  }

  if (kind === "service_area") {
    return "What is the correct current service area?";
  }

  if (kind === "hours") {
    return "What are the correct current business hours?";
  }

  if (kind === "service_availability") {
    return "Does the business currently offer this service?";
  }

  if (kind === "policy") {
    return "Which policy statement is current?";
  }

  return `Which statement is correct: "${first}" or "${second}"?`;
}

export function detectIntakeConflicts(
  facts: ExtractedBusinessFact[],
): DetectedIntakeConflict[] {
  const conflicts: DetectedIntakeConflict[] = [];

  for (let leftIndex = 0; leftIndex < facts.length; leftIndex += 1) {
    const first = facts[leftIndex];

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < facts.length;
      rightIndex += 1
    ) {
      const second = facts[rightIndex];

      const firstComparable = normalizeComparableText(first.content);
      const secondComparable = normalizeComparableText(second.content);

      if (!firstComparable || !secondComparable) continue;

      const exactDuplicate =
        first.category === second.category &&
        firstComparable === secondComparable;

      const contradictory = looksContradictory(first, second);

      if (!exactDuplicate && !contradictory) continue;

      const kind: ConflictKind = exactDuplicate
        ? "duplicate"
        : categoryConflictKind(first.category, first.content);

      const topic =
        normalizeInlineText(first.title) ||
        normalizeInlineText(second.title) ||
        first.category.replaceAll("_", " ");

      conflicts.push({
        id: stableIntakeId(
          `${kind}:${first.temporaryId}:${second.temporaryId}`,
          "detected_conflict",
        ),
        kind,
        topic,
        firstFactId: first.temporaryId,
        secondFactId: second.temporaryId,
        firstStatement: first.content,
        secondStatement: second.content,
        sourceExcerpts: [
          first.sourceExcerpt,
          second.sourceExcerpt,
        ],
        suggestedQuestion:
          kind === "duplicate"
            ? "These entries appear to say the same thing. Keep one?"
            : buildQuestion(kind, first.content, second.content),
      });
    }
  }

  return conflicts;
}
