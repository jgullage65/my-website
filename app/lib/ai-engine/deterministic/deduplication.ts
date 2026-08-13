import type { DeterministicFact, DuplicateGroup } from "./contracts";
import { keyText, stableId, uniqueBy } from "./util";

const CONCEPT_AGGREGATE_CATEGORIES = new Set<DeterministicFact["category"]>([
    "service",
    "product",
    "pricing_plan",
    "location_service_area",
    "certification",
    "integration",
    "industry_served",
    "primary_use_case",
    "support_onboarding",
    "customer_segment",
    "competitive_differentiator",
    "mission_value_proposition",
    "brand_voice_terminology",
]);

function isCustomerProof(fact: DeterministicFact) {
    if (fact.category !== "additional_business_knowledge") return false;
    return /\b(?:testimonial|review|recommend|customer service|client|customer|user|case study|success story|results?|outcome|rating|stars?)\b/i.test(
        `${fact.title} ${fact.value}`,
    );
}

function groupingKey(fact: DeterministicFact) {
    if (isCustomerProof(fact)) return "additional_business_knowledge:customer_proof";
    if (CONCEPT_AGGREGATE_CATEGORIES.has(fact.category)) return fact.topicKey;

    const agreement = keyText(fact.value)
        .replace(/\b(the|a|an)\b/g, "")
        .replace(/\s+/g, " ");
    return `${fact.topicKey}\0${agreement}`;
}

function evidenceQuality(fact: DeterministicFact) {
    const text = fact.value.trim();
    let score = 0;
    if (fact.provenance === "owner") score += 100;
    if (fact.evidence.some(item => item.structured)) score += 20;
    if (/\b(?:special|offer|price|licensed|certified|serves?|specializes?|experience|results?|review|testimonial|case study|award|proprietary)\b/i.test(text)) score += 6;
    if (/\b(?:privacy policy|terms of use|cookie|personal information|advertiser|do not track|\bdnt\b)\b/i.test(text)) score -= 25;
    return score;
}

function canonicalCustomerProof(values: DeterministicFact[]): DeterministicFact {
    const ranked = [...values].sort((a, b) => evidenceQuality(b) - evidenceQuality(a) || a.id.localeCompare(b.id));
    const first = ranked[0]!;
    return {
        ...first,
        id: stableId("det_fact", `additional_business_knowledge:customer_proof\0${values.map(value => value.id).sort().join("\0")}`),
        topicKey: "additional_business_knowledge:customer_proof",
        title: "Customer proof",
        value: "The website contains customer, client, or user proof supporting the business's quality, results, or outcomes.",
        evidence: uniqueBy(
            values.flatMap(value => value.evidence),
            item => `${item.sourceBlockId ?? ""}\0${item.url}\0${keyText(item.excerpt)}`,
        ),
    };
}

function mergeConceptValues(values: DeterministicFact[]): DeterministicFact {
    if (values.every(isCustomerProof)) return canonicalCustomerProof(values);

    const owner = values.find(value => value.provenance === "owner");
    const ranked = [...values].sort((a, b) => evidenceQuality(b) - evidenceQuality(a) || a.id.localeCompare(b.id));
    const first = owner ?? ranked[0]!;
    return {
        ...first,
        evidence: uniqueBy(
            values.flatMap(value => value.evidence),
            item => `${item.sourceBlockId ?? ""}\0${item.url}\0${keyText(item.excerpt)}`,
        ),
    };
}

export function deduplicateFacts(input: readonly DeterministicFact[]): {
    facts: DeterministicFact[];
    duplicateGroups: DuplicateGroup[];
} {
    const groups = new Map<string, DeterministicFact[]>();
    for (const original of input) {
        const fact: DeterministicFact = {
            ...original,
            evidence: original.evidence.map(item => ({ ...item })),
        };
        const key = groupingKey(fact);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(fact);
    }

    const facts: DeterministicFact[] = [];
    const duplicateGroups: DuplicateGroup[] = [];

    for (const values of Array.from(groups.values())) {
        const merged = mergeConceptValues(values);
        facts.push(merged);
        if (values.length > 1) {
            duplicateGroups.push({
                id: stableId("duplicate", values.map(value => value.id).sort().join("\0")),
                topicKey: merged.topicKey,
                factIds: values.map(value => value.id).sort(),
                mergedFactId: merged.id,
            });
        }
    }

    return {
        facts: facts.sort((a, b) => a.id.localeCompare(b.id)),
        duplicateGroups,
    };
}
