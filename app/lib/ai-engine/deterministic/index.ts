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
export * from "./contracts";
export { canonicalUrl } from "./util";
export { classifyPage } from "./classification";
export { normalizeSources } from "./normalization";
export { assembleSession } from "./sessionAssembly";
export function buildDeterministicBusinessBrain(input: DeterministicEngineInput): DeterministicEngineResult {
    const started = performance.now();
    const normalizedBlocks = normalizeSources(input);
    const extracted = [...extractOwnerFacts(input), ...extractWebsiteFacts(normalizedBlocks)];
    const deduplicated = deduplicateFacts(extracted);
    let conflicts = detectConflicts(deduplicated.facts);
    const facts = scoreConfidence(deduplicated.facts, conflicts);
    conflicts = detectConflicts(facts);
    const faqs = assembleFaqs(normalizedBlocks);
    const faqFacts = faqs.map(f => ({
        id: f.id,
        topicKey: `faq:${f.question.toLowerCase()}`,
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
    const { coverage, missingInformation } = calculateCoverage(allFacts, conflicts, faqs.length);
    const unresolved = missingInformation.map(m => m.suggestedQuestion);
    const partial = {
        facts: allFacts,
        categories: Array.from(new Set(allFacts.map(f => f.category))).sort(),
        duplicateGroups: deduplicated.duplicateGroups,
        conflicts,
        coverage,
        missingInformation,
        faqs,
        normalizedBlocks,
        websiteKnowledge: assembleWebsiteKnowledge(allFacts, coverage, unresolved),
        executionTimeMs: performance.now() - started
    };
    return {
        ...partial,
        session: assembleSession(partial, { sessionId: input.sessionId, now: input.now, owner: input.owner })
    };
}
