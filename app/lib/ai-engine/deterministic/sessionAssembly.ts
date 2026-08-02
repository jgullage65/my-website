import type { AiBuilderSession, BusinessContextCategory } from "../contracts";
import type { DeterministicEngineResult, OwnerKnowledge } from "./contracts";
import { stableId } from "./util";
const category = (value: string): BusinessContextCategory => value === "pricing_plan" ? "pricing" : value === "policy" || value === "security_compliance" ? "policy" : value === "customer_segment" || value === "industry_served" ? "audience" : value === "support_onboarding" ? "process" : value === "competitive_differentiator" ? "differentiator" : ["product", "service", "feature_capability", "primary_use_case", "integration", "ai_automation", "technical_capability"].includes(value) ? "service" : "business_profile";
const primaryEvidence = (fact: DeterministicEngineResult["facts"][number]) => [...fact.evidence].sort((left, right) => {
    const authority = Number(right.provenance === "owner") - Number(left.provenance === "owner");
    if (authority)
        return authority;
    const structure = Number(right.structured) - Number(left.structured);
    if (structure)
        return structure;
    return `${left.url}\0${left.sourceDocumentId ?? ""}\0${left.sourceBlockId ?? ""}\0${left.excerpt}`
        .localeCompare(`${right.url}\0${right.sourceDocumentId ?? ""}\0${right.sourceBlockId ?? ""}\0${right.excerpt}`);
})[0];
export function assembleSession(result: Omit<DeterministicEngineResult, "session">, options: {
    sessionId?: string;
    now?: string;
    owner?: OwnerKnowledge;
} = {}): AiBuilderSession {
    const now = options.now ?? new Date().toISOString(), sessionId = options.sessionId ?? stableId("demo_session", result.facts.map(f => f.id).join("\0"));
    const entries = result.facts.map(f => {
        const primary = primaryEvidence(f);
        return ({
        id: stableId("context", `${sessionId}\0${f.id}`),
        sessionId,
        category: category(f.category),
        title: f.title,
        content: f.value,
        confidence: f.confidence,
        confidenceScore: f.confidenceScore,
        status: "proposed" as const,
        source: {
            intakeBlockId: primary?.sourceBlockId ?? f.id,
            excerpt: primary?.excerpt ?? f.value,
            sourceType: f.provenance === "owner" ? "manual_intake" as const : "website" as const,
            sourceUrl: primary?.url
        },
        metadata: {
            generated: false,
            userEdited: false,
            conflictingEntryIds: [] as string[],
            tags: [f.category, `topic:${f.topicKey}`],
            upstreamSourceEntryIds: f.evidence.map(e => e.sourceBlockId).filter((x): x is string => Boolean(x)),
            mixedSourceProvenance: f.evidence.some(e => e.provenance === "owner") &&
                f.evidence.some(e => e.provenance === "website"),
            supportingEvidence: f.evidence.map(e => ({
                sourceUrl: e.url,
                excerpt: e.excerpt,
                sourceDocumentId: e.sourceDocumentId,
                sourceBlockId: e.sourceBlockId,
                crawlAttemptId: e.crawlAttemptId,
                heading: e.heading,
                pageType: e.pageType,
                sourceType: e.sourceType,
                provenance: e.provenance
            }))
        },
        createdAt: now,
        updatedAt: now
        });
    });
    const idByFact = new Map(result.facts.map((f, i) => [f.id, entries[i]!.id]));
    for (const conflict of result.conflicts) {
        const sessionEntryIds = conflict.factIds
            .map(id => idByFact.get(id))
            .filter((id): id is string => Boolean(id));
        for (const id of sessionEntryIds) {
            const entry = entries.find(e => e.id === id);
            if (entry)
                entry.metadata.conflictingEntryIds = sessionEntryIds.filter(other => other !== id);
        }
    }
    const faqEntries = result.faqs.map(f => ({
        id: f.id,
        sessionId,
        question: f.question,
        answer: f.answer,
        confidence: f.confidence,
        confidenceScore: f.confidenceScore,
        sourceEntryIds: f.sourceFactIds.map(id => idByFact.get(id)).filter((x): x is string => Boolean(x)),
        status: "proposed" as const,
        metadata: { generated: false, userEdited: false, tags: ["source-supported-faq"] },
        createdAt: now,
        updatedAt: now
    }));
    const all = [...entries, ...faqEntries];
    return {
        id: sessionId,
        status: "review_required",
        intakeBlocks: Object.entries(options.owner ?? {})
            .filter(([, v]) => Boolean(v))
            .map(([label, content]) => ({
            id: stableId("intake", `${sessionId}:${label}`),
            label,
            content: String(content),
            createdAt: now,
            updatedAt: now
        })),
        assistantConfiguration: {
            name: `${options.owner?.businessName ?? "Business"} Assistant`,
            purpose: "Answer questions using only reviewed business knowledge, distinguish owner-provided information from website evidence, surface unresolved conflicts, and never invent unsupported claims.",
            tone: options.owner?.tone ?? "Professional",
            responseStyle: "Give clear, specific answers grounded in approved evidence. Explain uncertainty, ask a focused follow-up when required information is missing, and escalate requests that need human judgment.",
            primaryAudience: options.owner?.idealCustomers ?? null,
            escalationInstructions: [
                "Do not resolve conflicting business facts without owner review.",
                "Do not promise pricing, policies, availability, outcomes, or guarantees that are not approved.",
                "Direct account-specific, legal, safety, and exceptional requests to a human."
            ]
        },
        contextEntries: entries,
        faqEntries,
        conflicts: result.conflicts.map(c => ({
            id: c.id,
            topic: c.topicKey,
            firstStatement: result.facts.find(f => f.id === c.factIds[0])?.value ?? "",
            secondStatement: result.facts.find(f => f.id === c.factIds[1])?.value ?? "",
            sourceExcerpts: c.factIds.flatMap(id => result.facts.find(f => f.id === id)?.evidence.map(e => e.excerpt) ?? []),
            suggestedQuestion: `Which information about ${c.topicKey.split(":").slice(1).join(":")} is current?`,
            resolved: false
        })),
        missingInformation: result.missingInformation.map(m => ({ ...m, resolved: false })),
        contextCounts: {
            total: all.length,
            approved: 0,
            proposed: all.length,
            archived: 0,
            byCategory: entries.reduce<Record<string, number>>((counts, e) => (counts[e.category] = (counts[e.category] ?? 0) + 1, counts), {})
        },
        buildProgress: [{
                stage: "complete",
                message: "Business Brain is ready for review.",
                completed: true,
                count: all.length,
                createdAt: now
            }],
        createdAt: now,
        updatedAt: now,
        expiresAt: null,
        governanceRevision: 0
    };
}
