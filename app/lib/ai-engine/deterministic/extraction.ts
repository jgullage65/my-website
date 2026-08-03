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
const money = /(?:[$£€]\s?\d|\d+(?:\.\d+)?\s?(?:usd|gbp|eur)|\b(?:free|pricing|per month|monthly|annual(?:ly)?|plan)\b)/i;
const RULES: Rule[] = [
    {
        category: "pricing_plan",
        pages: ["pricing"],
        evidence: money,
        topic: t => (t.match(/([\w -]{2,30}) (?:plan|package|tier)/i)?.[1] ?? t.slice(0, 45)),
        title: "Pricing and plan"
    },
    {
        category: "contact_information",
        pages: ["contact", "support", "home"],
        evidence: /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d ().-]{7,}\d)|\b(?:email|call|phone|contact)\b)/i,
        topic: t => (t.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ??
            t.match(/\+?\d[\d ().-]{7,}\d/)?.[0] ?? t.slice(0, 45)),
        title: "Contact method"
    },
    {
        category: "policy",
        pages: ["policies", "pricing", "support"],
        evidence: /\b(refund|return|cancel(?:lation)?|privacy|warranty|guarantee|terms|notice period|retention)\b/i,
        topic: t => (t.match(/\b(refund|return|cancel(?:lation)?|privacy|warranty|guarantee|terms|retention)[\w -]{0,20}/i)?.[0] ??
            t.slice(0, 45)),
        title: "Policy"
    },
    {
        category: "location_service_area",
        pages: ["locations", "contact", "home"],
        evidence: /\b(?:located|based|serv(?:e|ing|ice area)|office|address|available throughout|nationwide|worldwide)\b/i,
        topic: t => t.slice(0, 55),
        title: "Location or service area"
    },
    {
        category: "integration",
        pages: ["integrations", "technical"],
        evidence: /\b(?:integrates? with|integration|connects? (?:to|with)|compatible with|plugin for)\b/i,
        topic: t => t.replace(/^.*?\b(?:with|to|for)\b/i, "").slice(0, 45),
        title: "Integration"
    },
    {
        category: "security_compliance",
        pages: ["security", "compliance", "technical", "certifications", "about"],
        evidence: /\b(?:encrypted?|encryption|soc ?2|gdpr|hipaa|iso ?27001|sso|mfa|security|compliant?)\b/i,
        topic: t => (t.match(/\b(soc ?2|gdpr|hipaa|iso ?27001|sso|mfa|encryption)\b/i)?.[0] ?? t.slice(0, 45)),
        title: "Security and compliance"
    },
    {
        category: "certification",
        pages: ["certifications", "about"],
        evidence: /\b(?:certified|certification|accredited|accreditation)\b/i,
        topic: t => t.slice(0, 55),
        title: "Certification"
    },
    {
        category: "support_onboarding",
        pages: ["support", "onboarding"],
        evidence: /\b(?:support|onboarding|implementation|training|help desk|response time|getting started)\b/i,
        topic: t => t.slice(0, 55),
        title: "Onboarding and support"
    },
    {
        category: "partnership",
        pages: ["partnerships", "about"],
        evidence: /\b(?:partner(?:ship|ed)?|affiliate|reseller)\b/i,
        topic: t => t.slice(0, 55),
        title: "Partnership"
    },
    {
        category: "customer_segment",
        pages: ["industries", "use_cases", "home"],
        evidence: /\b(?:built for|designed for|serves?|helping|customers? (?:are|include)|teams? in)\b/i,
        topic: t => t.slice(0, 55),
        title: "Customer segment"
    },
    {
        category: "industry_served",
        pages: ["industries"],
        evidence: /\b(?:industries? (?:we )?serve|solutions? for|serving the)\b/i,
        topic: t => t.slice(0, 55),
        title: "Industry served"
    },
    {
        category: "primary_use_case",
        pages: ["use_cases"],
        evidence: /\b(?:use case|helps? (?:you|teams)|so (?:you|teams) can|used (?:to|for))\b/i,
        topic: t => t.slice(0, 55),
        title: "Use case"
    },
    {
        category: "ai_automation",
        pages: ["products", "services", "technical", "home", "use_cases"],
        heading: /\b(ai|automation|intelligence|agent|feature|capabilit)\b/i,
        evidence: /\b(?:artificial intelligence|machine learning|\bAI\b|automat(?:e|es|ed|ion)|agentic)\b/,
        topic: t => t.slice(0, 55),
        title: "AI and automation capability"
    },
    {
        category: "technical_capability",
        pages: ["technical"],
        evidence: /\b(?:api|sdk|webhook|developer|cloud|self-hosted|architecture|data export)\b/i,
        topic: t => t.slice(0, 55),
        title: "Technical capability"
    },
    {
        category: "product",
        pages: ["products"],
        evidence: /\b(?:product|platform|software|app|application|suite|tool)\b/i,
        heading: /./,
        topic: (t) => t.slice(0, 55),
        title: "Product"
    },
    {
        category: "service",
        pages: ["services"],
        evidence: /\b(?:we (?:offer|provide|deliver)|our services? include|service package|consulting|implementation|managed service)\b/i,
        heading: /./,
        topic: t => t.slice(0, 55),
        title: "Service"
    },
    {
        category: "feature_capability",
        pages: ["products", "services", "technical", "home"],
        evidence: /\b(?:features?|capabilit|includes?|enables?|allows? (?:you|teams)|can (?:create|manage|track|connect|generate|automate))\b/i,
        topic: t => t.slice(0, 55),
        title: "Feature or capability"
    },
    {
        category: "mission_value_proposition",
        pages: ["about", "home"],
        evidence: /\b(?:our mission|we exist to|we believe|helps? .{2,40} (?:save|grow|reduce|increase|improve)|so you can)\b/i,
        topic: t => t.slice(0, 55),
        title: "Mission and value proposition"
    },
    {
        category: "competitive_differentiator",
        pages: ["about", "home", "products", "services"],
        evidence: /\b(?:unlike|only|unique|proprietary|award-winning|differentiates?|without (?:the|any)|faster than)\b/i,
        topic: t => t.slice(0, 55),
        title: "Competitive differentiator"
    },
    {
        category: "company_overview",
        pages: ["about"],
        evidence: /\b(?:we are|founded|our company|our team|specializes? in|is a[n]? )\b/i,
        topic: t => "company",
        title: "Company overview"
    },
    {
        category: "brand_voice_terminology",
        evidence: /\b(?:we call (?:this|it|our)|known as|referred to as|our (?:method|framework|approach))\b/i,
        topic: t => t.slice(0, 55),
        title: "Brand terminology"
    },
    {
        category: "additional_business_knowledge",
        pages: ["case_studies"],
        evidence: /\b(?:case study|resulted in|increased|reduced|grew|saved|delivered)\b/i,
        heading: /./,
        topic: t => t.slice(0, 55),
        title: "Case study"
    },
    {
        category: "additional_business_knowledge",
        pages: ["testimonials"],
        evidence: /(?:[“”"]|\b(?:testimonial|customer said|client said|recommend|working with)\b)/i,
        heading: /./,
        topic: t => t.slice(0, 55),
        title: "Testimonial"
    },
];
const RULE_PRIORITY: Partial<Record<Category, number>> = {
    pricing_plan: 100,
    policy: 95,
    contact_information: 95,
    integration: 90,
    security_compliance: 90,
    feature_capability: 80,
    product: 60,
    service: 60,
    additional_business_knowledge: 50
};
const PRIORITIZED_RULES = [...RULES].sort((left, right) =>
    (RULE_PRIORITY[right.category] ?? 70) - (RULE_PRIORITY[left.category] ?? 70));
function sentences(text: string): string[] {
    return text.split(/(?<=[.!])\s+|\n+/)
        .map(cleanText)
        .filter((x) => x.length >= 12 && x.length <= 1200);
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
            const names = namedList(list).map(name => name.replace(/\s+services?$/i, "")).filter(name => /\b(?:consulting|implementation|training|management|design|optimization|cleaning|strategy)\b/i.test(name));
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
        const list = text.match(/\b(?:(?:offices? (?:are )?(?:located )?in)|(?:we )?serve|available throughout)\s+(.+?)(?:[.!]|$)/i)?.[1];
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
            const matchedCategories = new Set<Category>();
            for (const rule of PRIORITIZED_RULES) {
                const pageMatch = !rule.pages || rule.pages.includes(block.pageType);
                const headingMatch = !rule.heading || rule.heading.test(structuralContext);
                const standardClaim = /\b(?:soc ?(?:2|ii)|hipaa|iso ?27001|gdpr)\b/i.test(text);
                const categoryConsistent = rule.category !== "certification" || !standardClaim;
                if (pageMatch && headingMatch && categoryConsistent && rule.evidence.test(text) && !matchedCategories.has(rule.category)) {
                    const expansions = expand(rule, text);
                    if (expansions?.length) for (const item of expansions)
                        facts.push(makeFact(rule.category, rule.title, item.value, item.topic, block.evidence, true, text));
                    else facts.push(makeFact(rule.category, rule.title, text, rule.topic(text), block.evidence));
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
                // Mixed output requires two independently named concepts; generic
                // co-mentions retain the historical single-category behavior.
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
            facts.push(makeFact(resolved, title, part, part.slice(0, 55), evidence(part, title)));
        }
    return facts;
}
