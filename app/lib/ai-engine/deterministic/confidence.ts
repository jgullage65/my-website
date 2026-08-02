import type { DeterministicFact, MaterialConflict } from "./contracts";
import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
const RELEVANCE: Record<string, string[]> = {
    pricing_plan: ["pricing"],
    policy: ["policies", "support", "pricing"],
    contact_information: ["contact", "support"],
    service: ["services"],
    product: ["products"],
    integration: ["integrations"],
    security_compliance: ["security", "compliance"],
    certification: ["certifications"],
    location_service_area: ["locations", "contact"]
};
export function confidenceLevel(score: number): WebsiteKnowledgeFact["confidence"] {
    return score >= 78 ? "high" : score >= 52 ? "medium" : "low";
}
export function scoreConfidence(facts: readonly DeterministicFact[], conflicts: readonly MaterialConflict[]): DeterministicFact[] {
    const conflicting = new Set(conflicts.flatMap(c => c.factIds));
    return facts.map(fact => {
        const pages = new Set(fact.evidence.map(e => e.url));
        let score = fact.provenance === "owner" ? 82 : 46;
        if (fact.explicit)
            score += 10;
        if (fact.evidence.some(e => e.structured))
            score += 8;
        if (fact.evidence.some(e => Boolean(e.heading)))
            score += 5;
        if (fact.evidence.some(e => (RELEVANCE[fact.category] ?? []).includes(e.pageType)))
            score += 8;
        score += Math.min(12, (fact.evidence.length - 1) * 4);
        score += Math.min(8, (pages.size - 1) * 4);
        if (fact.value.length < 20)
            score -= 8;
        if (/\b(?:may|might|typically|generally|approximately)\b/i.test(fact.value))
            score -= 8;
        if (conflicting.has(fact.id))
            score -= 18;
        score = Math.max(5, Math.min(99, score));
        return {
            ...fact,
            confidenceScore: score,
            confidence: confidenceLevel(score)
        };
    });
}
