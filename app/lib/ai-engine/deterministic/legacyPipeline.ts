import { scoreConfidence } from "./confidence";
import { detectConflicts } from "./conflicts";
import type {
  DeterministicEngineInput,
  DeterministicEngineResult,
} from "./contracts";
import { calculateCoverage } from "./coverage";
import { deduplicateFacts } from "./deduplication";
import { extractOwnerFacts, extractWebsiteFacts } from "./extraction";
import { assembleFaqs } from "./faqs";
import { normalizeSources } from "./normalization";
import { assembleSession } from "./sessionAssembly";
import { assembleWebsiteKnowledge } from "./websiteKnowledge";
import { stableId } from "./util";
import { canonicalTopicKey } from "./topics";
import { assembleBusinessConcepts } from "./concepts";
import { assembleConceptRelationships } from "./relationships";

export function buildLegacyDeterministicBusinessBrain(
  input: DeterministicEngineInput,
): DeterministicEngineResult {
  const normalizedBlocks = normalizeSources(input);
  const extracted = [
    ...extractOwnerFacts(input),
    ...extractWebsiteFacts(normalizedBlocks),
  ];
  const deduplicated = deduplicateFacts(extracted);
  let conflicts = detectConflicts(deduplicated.facts);
  const facts = scoreConfidence(deduplicated.facts, conflicts);
  conflicts = detectConflicts(facts);
  const faqs = assembleFaqs(normalizedBlocks);
  const faqFacts = faqs.map((faq) => ({
    id: faq.id,
    topicKey: canonicalTopicKey({
      category: "faq",
      value: faq.question,
      suggestedTopic: faq.question,
    }),
    category: "faq" as const,
    title: faq.question,
    value: faq.answer,
    confidence: faq.confidence,
    confidenceScore: faq.confidenceScore,
    provenance: "website" as const,
    evidence: faq.evidence,
    explicit: true,
  }));
  const allFacts = [...facts, ...faqFacts].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const concepts = assembleBusinessConcepts(allFacts, conflicts);
  const relationships = assembleConceptRelationships(
    allFacts,
    concepts,
    conflicts,
  );
  const sessionId =
    input.sessionId ??
    stableId(
      "demo_session",
      allFacts.map((fact) => fact.id).join("\0"),
    );
  const linkedConflicts = conflicts.map((conflict) => ({
    ...conflict,
    factIds: [...conflict.factIds],
    websiteFactIds: [...conflict.websiteFactIds],
    sessionEntryIds: conflict.factIds.map((factId) =>
      stableId("context", `${sessionId}\0${factId}`),
    ),
  }));
  const { coverage, missingInformation } = calculateCoverage(
    allFacts,
    linkedConflicts,
    faqs.length,
  );
  const unresolved = missingInformation.map(
    (item) => item.suggestedQuestion,
  );
  const partial = {
    facts: allFacts,
    concepts,
    relationships,
    categories: Array.from(new Set(allFacts.map((fact) => fact.category))).sort(),
    duplicateGroups: deduplicated.duplicateGroups,
    conflicts: linkedConflicts,
    coverage,
    missingInformation,
    faqs,
    normalizedBlocks,
    websiteKnowledge: assembleWebsiteKnowledge(
      allFacts,
      coverage,
      unresolved,
    ),
    executionTimeMs: 0,
  };

  return {
    ...partial,
    session: assembleSession(partial, {
      sessionId,
      now: input.now,
      owner: input.owner,
    }),
  };
}
