import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { DeterministicEngineInput, DeterministicFact, NormalizedEvidence, NormalizedSourceBlock } from "./contracts";
import { cleanText, keyText, stableId } from "./util";
import { canonicalTopicKey } from "./topics";
type Category = WebsiteKnowledgeFact["category"];
type Rule = {
    category: Category;
    pages?: string[];
    evidence: RegExp;
    heading?: RegExp;
    topic: (text: string) => string;
    title: string;
};
const money = /(?:[$£€]\s?\d|\d+(?:\.\d+)?\s?(?:usd|gbp|eur)|\b(?:free|pricing|per month|monthly|annual(?:ly)?|plan|special|offer|discount)\b)/i;
const RULES: Rule[] = [
    {
        category: "pricing_plan",
        evidence: /(?:[$£€]\s?\d|\b(?:new patient|introductory|limited[- ]time)?\s+(?:special|offer)\b|\b(?:special|offer|discount|pricing|price|plan|package|tier)\b.{0,80}(?:[$£€]\s?\d|\bfree\b)|(?:[$£€]\s?\d).{0,80}\b(?:special|offer|visit|consultation|session|package|plan)\b)/i,
        topic: t => (t.match(/([\w $£€'-]{2,45}) (?:special|offer|plan|package|tier)/i)?.[0] ?? cleanText(t)),
        title: "Pricing or offer"
    },
    {
        category: "contact_information",
        pages: ["contact", "support", "home"],
        evidence: /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d ().-]{7,}\d)|\b(?:email|call|phone|contact)\b)/i,
        topic: t => (t.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ??
            t.match(/\+?\d[\d ().-]{7,}\d/)?.[0] ?? cleanText(t)),
        title: "Contact method"
    },
    {
        category: "policy",
        pages: ["policies"],
        evidence: /\b(?:refund|return|cancel(?:lation)?|privacy policy|warranty|guarantee|terms of use|data retention|personal information|opt[- ]out|deletion request)\b/i,
        topic: t => (t.match(/\b(refund|return|cancel(?:lation)?|privacy policy|warranty|guarantee|terms of use|data retention|personal information)[\w -]{0,20}/i)?.[0] ?? cleanText(t)),
        title: "Policy"
    },
    {
        category: "location_service_area",
        evidence: /\b(?:located|based|serv(?:e|es|ing|ice area)|office|address|available (?:in|throughout)|serving patients in|serving clients in|surrounding area|surrounding areas|nationwide|worldwide)\b/i,
        topic: t => cleanText(t),
        title: "Location or service area"
    },
    {
        category: "integration",
        pages: ["integrations", "technical"],
        evidence: /\b(?:integrates? with|integration|connects? (?:to|with)|compatible with|plugin for)\b/i,
        topic: t => cleanText(t.replace(/^.*?\b(?:with|to|for)\b/i, "")),
        title: "Integration"
    },
    {
        category: "security_compliance",
        pages: ["security", "compliance", "technical", "certifications"],
        evidence: /\b(?:encrypted?|encryption|soc ?(?:2|ii)|gdpr|hipaa|iso ?27001|sso|mfa|multi-factor authentication|penetration testing|data encryption)\b/i,
        topic: t => (t.match(/\b(soc ?(?:2|ii)|gdpr|hipaa|iso ?27001|sso|mfa|encryption|encrypted)\b/i)?.[0] ?? cleanText(t)),
        title: "Security and compliance"
    },
    {
        category: "certification",
        evidence: /\b(?:licensed|license(?:d)?|certified|certification|accredited|accreditation|doctor of [a-z ]+ degree|degree from|board[- ]certified)\b/i,
        topic: t => cleanText(t),
        title: "Credential or certification"
    },
    {
        category: "support_onboarding",
        evidence: /\b(?:support|onboarding|implementation|training|help desk|response time|getting started|new patient|first visit|initial evaluation|consultation|review(?:ing)? findings|x-?rays?|day\s*[12]|follow[- ]up visit|treatment plan|recovery roadmap)\b/i,
        topic: t => cleanText(t),
        title: "Process or onboarding"
    },
    {
        category: "partnership",
        pages: ["partnerships", "about"],
        evidence: /\b(?:partner(?:ship|ed)?|affiliate|reseller)\b/i,
        topic: t => cleanText(t),
        title: "Partnership"
    },
    {
        category: "customer_segment",
        evidence: /\b(?:built for|designed for|serves?|serving|helping|customers? (?:are|include)|clients? (?:are|include)|patients?|teams? in|businesses? in|people (?:with|who))\b/i,
        topic: t => cleanText(t),
        title: "Customer segment"
    },
    {
        category: "industry_served",
        pages: ["industries"],
        evidence: /\b(?:industries? (?:we )?serve|solutions? for|serving the)\b/i,
        topic: t => cleanText(t),
        title: "Industry served"
    },
    {
        category: "primary_use_case",
        evidence: /\b(?:use case|helps? (?:you|teams|patients|clients)|used (?:to|for)|treats?|treating|care for|relief from|pain|sciatica|numbness|tingling|injur(?:y|ies)|whiplash|disc(?:-related)?|spinal stenosis)\b/i,
        topic: t => cleanText(t),
        title: "Primary use case"
    },
    {
        category: "ai_automation",
        pages: ["products", "services", "technical", "home", "use_cases"],
        heading: /\b(ai|automation|intelligence|agent|feature|capabilit)\b/i,
        evidence: /\b(?:artificial intelligence|machine learning|\bAI\b|automat(?:e|es|ed|ion)|agentic)\b/,
        topic: t => cleanText(t),
        title: "AI and automation capability"
    },
    {
        category: "technical_capability",
        pages: ["technical"],
        evidence: /\b(?:api|sdk|webhook|developer|cloud|self-hosted|architecture|data export)\b/i,
        topic: t => cleanText(t),
        title: "Technical capability"
    },
    {
        category: "product",
        pages: ["products"],
        evidence: /\b(?:product|platform|software|app|application|suite|tool)\b/i,
        heading: /./,
        topic: t => cleanText(t),
        title: "Product"
    },
    {
        category: "service",
        evidence: /\b(?:we (?:offer|provide|deliver)|our services? include|offers?|provides?|specializes? in|specializing in|treatment|therapy|care|consulting|implementation|managed service|spinal decompression|chiropractic|auto accident injury)\b/i,
        topic: t => cleanText(t),
        title: "Service"
    },
    {
        category: "feature_capability",
        pages: ["products", "services", "technical", "home"],
        evidence: /\b(?:features?|capabilit|includes?|enables?|allows? (?:you|teams)|can (?:create|manage|track|connect|generate|automate))\b/i,
        topic: t => cleanText(t),
        title: "Feature or capability"
    },
    {
        category: "mission_value_proposition",
        pages: ["about", "home"],
        evidence: /\b(?:our mission|we exist to|we believe|helps? .{2,40} (?:save|grow|reduce|increase|improve)|so you can|core values?|philosophy|approach)\b/i,
        topic: t => cleanText(t),
        title: "Mission and value proposition"
    },
    {
        category: "competitive_differentiator",
        pages: ["about", "home", "products", "services"],
        evidence: /\b(?:unlike|only|unique|proprietary|award-winning|differentiates?|without (?:the|any)|faster than|over (?:a|one) decade|more than \d+ years|over \d+ years|advanced|proven methods?|goes above and beyond)\b/i,
        topic: t => cleanText(t),
        title: "Competitive differentiator"
    },
    {
        category: "company_overview",
        pages: ["about", "home"],
        evidence: /\b(?:we are|founded|our company|our team|specializes? in|is a[n]? |practice|clinic|agency|studio|company)\b/i,
        topic: () => "company",
        title: "Company overview"
    },
    {
        category: "brand_voice_terminology",
        evidence: /\b(?:we call (?:this|it|our)|known as|referred to as|our (?:method|framework|approach)|core values?|healing journey|recovery roadmap)\b/i,
        topic: t => cleanText(t),
        title: "Brand terminology"
    },
    {
        category: "additional_business_knowledge",
        pages: ["case_studies"],
        evidence: /\b(?:case study|resulted in|increased|reduced|grew|saved|delivered)\b/i,
        heading: /./,
        topic: t => cleanText(t),
        title: "Case study"
    },
    {
        category: "additional_business_knowledge",
        evidence: /(?:[“”"]|\b(?:testimonial|review|reviews|customer said|client said|patient said|recommend|highly recommend|life-changing|worked wonders|customer service|helped me tremendously|made a big difference)\b)/i,
        topic: t => cleanText(t),
        title: "Customer proof"
    },
    {
        category: "faq",
        evidence: /\b(?:faq|frequently asked|is .* safe|how long|who is a candidate|can i|do you accept|insurance|ppo|hsa|fsa|first visit|first day|prior surgery|candidate for|what conditions)\b/i,
        topic: t => cleanText(t),
        title: "FAQ"
    },
];
const RULE_PRIORITY: Partial<Record<Category, number>> = {
    pricing_plan: 110,
    service: 105,
    product: 105,
    primary_use_case: 100,
    competitive_differentiator: 95,
    certification: 94,
    location_service_area: 92,
    support_onboarding: 90,
    faq: 88,
    additional_business_knowledge: 86,
    customer_segment: 82,
    contact_information: 70,
    feature_capability: 70,
    integration: 65,
    policy: 30,
    security_compliance: 25,
};
const PRIORITIZED_RULES = [...RULES].sort((left, right) =>
    (RULE_PRIORITY[right.category] ?? 70) - (RULE_PRIORITY[left.category] ?? 70));
const COMMERCIAL_CATEGORIES = new Set<Category>([
    "pricing_plan",
    "product",
    "service",
    "feature_capability",
    "customer_segment",
    "industry_served",
    "primary_use_case",
    "location_service_area",
    "competitive_differentiator",
    "mission_value_proposition",
    "certification",
    "support_onboarding",
    "brand_voice_terminology",
    "additional_business_knowledge",
]);
function sentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+|\n+/)
        .map(cleanText)
        .filter((x) => x.length >= 12 && x.length <= 1200);
}
function isContractBoilerplate(text: string): boolean {
    return /\b(?:may include|may update|may modify|may improve|may discontinue|does not guarantee|cannot guarantee|limits may vary|covered items may include|service commitments covered items|lost revenue or business opportunities|third-party service failures|subject to change|at any time without notice)\b/i.test(text);
}
function isNonBusinessCommercialContext(text: string): boolean {
    return /\b(?:personal information|personally identifiable|ip address|cookies?|pixels?|advertisers?|advertising partners?|do not track|\bdnt\b|browser information|device information|tracking technolog|data collection|data retention|third[- ]party sites?|services usage|consumer privacy|ccpa|other party(?:'s)?|insurance card|identify the other party|exchange information|consult an attorney|protect your rights)\b/i.test(text);
}
function meaningfulTitle(rule: Rule, _topic: string, evidence: NormalizedEvidence): string {
    const heading = cleanText(evidence.heading ?? "");
    if (heading && heading.length >= 3 && !/^(features?|capabilit(?:y|ies)|overview|details?|information|home|about|services?|products?|contact|faq)$/i.test(heading)) return heading;
    return rule.title;
}
function makeFact(category: Category, title: string, value: string, topic: string, evidence: NormalizedEvidence, explicit = true, evidenceExcerpt = value): DeterministicFact {
    const topicKey = canonicalTopicKey({ category, value, suggestedTopic: topic, heading: evidence.heading, pageType: evidence.pageType });
    return {
        id: stableId("det_fact", `${topicKey}\0${keyText(value)}\0${evidence.provenance}`),
        category,
        title,
        value,
        topicKey,
        confidence: "medium",
        confidenceScore: 0,
        provenance: evidence.provenance,
        evidence: [{ ...evidence, excerpt: evidenceExcerpt }],
        explicit
    };
}

type Expansion = { value: string; topic: string };
const trimmedEntity = (value: string) => cleanText(value).replace(/^(?:and|or)\s+/i, "").replace(/[.,:;]+$/g, "");
function namedList(value: string): string[] {
    return value.split(/\s*(?:,|\band\b|\bor\b)\s*/i).map(trimmedEntity).filter(Boolean);
}
function uniqueExpansions(values: string[]): Expansion[] {
    const seen = new Set<string>();
    return values.map(trimmedEntity).filter(value => {
        const key = keyText(value);
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
    }).map(value => ({ value, topic: value }));
}
/** Expand only grammar that explicitly identifies the list's semantic type. */
function expand(rule: Rule, text: string): Expansion[] | undefined {
    if (rule.category === "security_compliance") {
        const claims = Array.from(text.matchAll(/\b(SOC\s*(?:II|2)|HIPAA|ISO\s*27001|GDPR|encryption|encrypted|SSO|MFA)\b/gi), match => match[1]);
        if (claims.length > 1) return uniqueExpansions(claims);
    }
    if (rule.category === "integration") {
        const list = text.match(/\b(?:integrates? with|connects? (?:to|with)|compatible with|plugins? for)\s+(.+?)(?:[.!]|$)/i)?.[1];
        if (list) {
            const names = namedList(list).filter(name => /^[A-Z][A-Za-z0-9 .+&-]{1,45}$/.test(name));
            if (names.length > 1) return uniqueExpansions(names);
        }
    }
    if (rule.category === "pricing_plan") {
        const plans = Array.from(text.matchAll(/\b([A-Z][A-Za-z0-9 '&-]{0,30}?)\s+(?:plan|package|tier)\b/g), match => `${match[1]} plan`);
        if (plans.length > 1) return uniqueExpansions(plans);
    }
    if (rule.category === "service") {
        const list = text.match(/\b(?:we (?:offer|provide|deliver)|our services? include)\s+(.+?)(?:[.!]|$)/i)?.[1];
        if (list) {
            const names = namedList(list).map(name => name.replace(/\s+services?$/i, "")).filter(name => /\b(?:consulting|implementation|training|management|design|optimization|cleaning|strategy|therapy|treatment|care|chiropractic)\b/i.test(name));
            if (names.length > 1) return uniqueExpansions(names);
        }
    }
    if (rule.category === "product") {
        const list = text.match(/\b(?:our products? include|we (?:offer|sell)|products?:)\s+(.+?)(?:[.!]|$)/i)?.[1];
        if (list) {
            const names = namedList(list).filter(name => /\b(?:product|platform|software|app|application|suite|tool)\b/i.test(name));
            if (names.length > 1) return uniqueExpansions(names);
        }
    }
    if (rule.category === "location_service_area") {
        const list = text.match(/\b(?:(?:offices? (?:are )?(?:located )?in)|(?:we )?serve|available (?:in|throughout)|serving (?:patients|clients)?\s*(?:in)?)\s+(.+?)(?:[.!]|$)/i)?.[1];
        if (list) {
            const names = namedList(list).filter(name => /^(?:[A-Z][a-z]+(?:[ -][A-Z][a-z]+){0,2})$/.test(name));
            if (names.length > 1) return uniqueExpansions(names);
        }
    }
    return undefined;
}
export function extractWebsiteFacts(blocks: readonly NormalizedSourceBlock[]): DeterministicFact[] {
    const facts: DeterministicFact[] = [];
    const byId = new Map(blocks.map((block) => [block.id, block]));
    for (const block of blocks) {
        if (block.type === "heading" || block.type === "faq_question")
            continue;
        const previous = block.previousBlockId ? byId.get(block.previousBlockId) : undefined;
        const structuralContext = `${block.heading ?? ""} ${previous?.type === "heading" ? previous.text : ""}`;
        for (const text of sentences(block.text)) {
            if (isContractBoilerplate(text)) continue;
            const matchedCategories = new Set<Category>();
            const nonBusinessCommercialContext = isNonBusinessCommercialContext(text);
            for (const rule of PRIORITIZED_RULES) {
                const pageMatch = !rule.pages || rule.pages.includes(block.pageType);
                const headingMatch = !rule.heading || rule.heading.test(structuralContext);
                const standardClaim = /\b(?:soc ?(?:2|ii)|hipaa|iso ?27001|gdpr)\b/i.test(text);
                const categoryConsistent = rule.category !== "certification" || !standardClaim;
                const businessContextConsistent = !COMMERCIAL_CATEGORIES.has(rule.category) || !nonBusinessCommercialContext;
                if (pageMatch && headingMatch && categoryConsistent && businessContextConsistent && rule.evidence.test(text) && !matchedCategories.has(rule.category)) {
                    const expansions = expand(rule, text);
                    if (expansions?.length) for (const item of expansions)
                        facts.push(makeFact(rule.category, meaningfulTitle(rule, item.topic, block.evidence), item.value, item.topic, block.evidence, true, text));
                    else {
                        const topic = rule.topic(text);
                        facts.push(makeFact(rule.category, meaningfulTitle(rule, topic, block.evidence), text, topic, block.evidence));
                    }
                    matchedCategories.add(rule.category);
                }
            }
        }
    }
    return facts;
}
function ownerParts(value: string): string[] {
    return value.split(/\n+|;|(?<=[.!?])\s+/).map(cleanText).filter((x) => x.length > 2);
}
export function extractOwnerFacts(input: DeterministicEngineInput): DeterministicFact[] {
    const owner = input.owner ?? {};
    const evidence = (excerpt: string, heading: string): NormalizedEvidence => ({
        url: "owner://business-information",
        excerpt,
        heading,
        pageType: "other",
        sourceType: "owner",
        provenance: "owner",
        structured: true
    });
    const facts: DeterministicFact[] = [];
    if (cleanText(owner.businessName))
        facts.push(makeFact("business_identity", "Business name", cleanText(owner.businessName), "business name", evidence(cleanText(owner.businessName), "Business profile")));
    if (cleanText(owner.industry)) {
        const industry = cleanText(owner.industry);
        facts.push(makeFact("industry_served", "Industry", industry, industry, evidence(industry, "Industry")));
    }
    const fields: Array<[
        keyof typeof owner,
        Category,
        string
    ]> = [
        ["productsServices", "additional_business_knowledge", "Products and services"],
        ["idealCustomers", "customer_segment", "Ideal customers"],
        ["policiesOperations", "policy", "Policies and operations"],
        ["caseStudiesTestimonials", "additional_business_knowledge", "Case studies and testimonials"],
        ["additionalKnowledge", "additional_business_knowledge", "Additional owner knowledge"],
        ["tone", "brand_voice_terminology", "Brand voice"]
    ];
    for (const [field, category, title] of fields)
        for (const part of ownerParts(cleanText(owner[field]))) {
            let resolved = category;
            if (money.test(part))
                resolved = "pricing_plan";
            else if (/\b(refund|cancel|privacy|policy|warranty|guarantee)\b/i.test(part))
                resolved = "policy";
            else if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(part))
                resolved = "contact_information";
            else if (/\b(testimonial|case study|resulted in|increased|reduced)\b/i.test(part))
                resolved = "additional_business_knowledge";
            else if (field === "productsServices" &&
                /\b(product|platform|software|app|application|tool|suite|license|subscription)\b/i
                    .test(part) &&
                /\b(service|consulting|implementation|training|managed|we (?:provide|deliver|offer)|done-for-you)\b/i
                    .test(part)) {
                const product = trimmedEntity(part.match(/\b([A-Z][A-Za-z0-9-]*(?:\s+[A-Za-z0-9-]+){0,3}\s+(?:software|platform|product|app|application|tool|suite))\b/)?.[1] ?? "");
                const service = trimmedEntity(part.match(/\b([A-Za-z][A-Za-z -]{0,35}?(?:implementation services?|consulting services?|managed services?|training services?))\b/i)?.[1] ?? "");
                if (product && service) {
                    const ownerEvidence = evidence(part, title);
                    facts.push(makeFact("product", title, product, product, ownerEvidence, true, part));
                    facts.push(makeFact("service", title, service, service, ownerEvidence, true, part));
                    continue;
                }
                resolved = "product";
            }
            else if (field === "productsServices" &&
                /\b(product|platform|software|app|application|tool|suite|license|subscription)\b/i.test(part))
                resolved = "product";
            else if (field === "productsServices" &&
                /\b(service|consulting|implementation|training|managed|we (?:provide|deliver|offer)|done-for-you)\b/i.test(part))
                resolved = "service";
            facts.push(makeFact(resolved, title, part, part, evidence(part, title)));
        }
    return facts;
}