import { scoreConfidence } from "./confidence";
import { detectConflicts } from "./conflicts";
import type { DeterministicEngineInput, DeterministicEngineResult } from "./contracts";
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
import { recoverCommercialPageFacts } from "./businessRelevance";
import { routeSourceBlocks } from "./routing";
import { assignFactsToOwners } from "./specialists";
export * from "./contracts";
export * from "./ownership";
export * from "./routing";
export { canonicalUrl } from "./util";
export { classifyPage } from "./classification";
export { normalizeSources } from "./normalization";
export { assembleSession } from "./sessionAssembly";
export { canonicalTopicKey } from "./topics";
export { assembleBusinessConcepts, conceptDisplayName } from "./concepts";
export { assessConceptImportance } from "./conceptImportance";
export { assembleConceptRelationships } from "./relationships";
export { assignFactsToOwners } from "./specialists";
export function buildDeterministicBusinessBrain(input: DeterministicEngineInput): DeterministicEngineResult {
    const started = performance.now();
    const normalizedBlocks = normalizeSources(input);
    const routedBlocks = routeSourceBlocks(normalizedBlocks);
    const rawCandidates = [...extractOwnerFacts(input), ...extractWebsiteFacts(normalizedBlocks)];
    const structurallyRecoveredCandidates = recoverCommercialPageFacts(rawCandidates, normalizedBlocks);
    const ownedCandidates = assignFactsToOwners(structurallyRecoveredCandidates, routedBlocks);
    const deduplicated = deduplicateFacts(ownedCandidates);
    let conflicts = detectConflicts(deduplicated.facts);
    const facts = scoreConfidence(deduplicated.facts, conflicts);
    conflicts = detectConflicts(facts);
    const faqs = assembleFaqs(normalizedBlocks);
    const faqFacts = faqs.map(f => ({
        id: f.id,
        topicKey: canonicalTopicKey({ category: "faq", value: f.question, suggestedTopic: f.question }),
        category: "faq" as const,
        title: f.question,
        value: f.answer,
        confidence: f.confidence,
        confidenceScore: f.confidenceScore,
        provenance: "website" as const,
        evidence: f.evidence,
        explicit: true
    }));
    const allFacts = [...facts, ...faqFacts].sort((a, b) => a.id.localeCompare(b.id));
    const concepts = assembleBusinessConcepts(allFacts, conflicts);
    const relationships = assembleConceptRelationships(allFacts, concepts, conflicts);
    const sessionId = input.sessionId ?? stableId("demo_session", allFacts.map(f => f.id).join("\0"));
    const linkedConflicts = conflicts.map(conflict => ({
        ...conflict,
        factIds: [...conflict.factIds],
        websiteFactIds: [...conflict.websiteFactIds],
        sessionEntryIds: conflict.factIds.map(factId => stableId("context", `${sessionId}\0${factId}`))
    }));
    const { coverage, missingInformation } = calculateCoverage(allFacts, linkedConflicts, faqs.length);
    const unresolved = missingInformation.map(m => m.suggestedQuestion);
    const partial = {
        facts: allFacts,
        concepts,
        relationships,
        categories: Array.from(new Set(allFacts.map(f => f.category))).sort(),
        duplicateGroups: deduplicated.duplicateGroups,
        conflicts: linkedConflicts,
        coverage,
        missingInformation,
        faqs,
        normalizedBlocks,
        websiteKnowledge: assembleWebsiteKnowledge(allFacts, coverage, unresolved),
        executionTimeMs: performance.now() - started
    };
    return {
        ...partial,
        session: assembleSession(partial, { sessionId, now: input.now, owner: input.owner })
    };
}
