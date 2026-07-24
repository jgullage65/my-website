export const WEBSITE_KNOWLEDGE_CATEGORIES = [
  "company_overview", "mission_value_proposition",
  "business_identity", "industry", "product", "service", "customer", "pricing",
  "policy", "process", "faq", "differentiator", "guarantee", "location",
  "contact", "other", "feature_capability", "pricing_plan", "customer_segment",
  "industry_served", "primary_use_case", "integration", "ai_automation",
  "technical_capability", "security_compliance", "certification",
  "support_onboarding", "partnership", "location_service_area",
  "contact_information", "brand_voice_terminology",
  "competitive_differentiator", "additional_business_knowledge",
] as const;

export const WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const WEBSITE_KNOWLEDGE_COVERAGE_FIELDS = [
  "businessIdentity", "offers", "customers", "pricing", "policies", "processes",
  "faq", "contact", "overall", "companyOverview", "missionValueProposition",
  "products", "services", "featuresCapabilities", "pricingPlans",
  "customerSegments", "industriesServed", "primaryUseCases", "integrations",
  "aiFeaturesAutomation", "technicalCapabilities", "securityCompliance",
  "certifications", "supportOnboarding", "partnerships",
  "locationsServiceAreas", "contactInformation", "brandVoiceTerminology",
  "frequentlyAskedQuestions", "competitiveDifferentiators",
  "additionalBusinessKnowledge",
] as const;

export const WEBSITE_KNOWLEDGE_SECTION_ORDER = [
  "company_overview", "mission_value_proposition", "product", "service",
  "feature_capability", "pricing_plan", "customer_segment", "industry_served",
  "primary_use_case", "integration", "ai_automation", "technical_capability",
  "security_compliance", "certification", "support_onboarding", "partnership",
  "location_service_area", "contact_information", "brand_voice_terminology",
  "faq", "policy", "competitive_differentiator",
  "additional_business_knowledge",
] as const;

export const WEBSITE_KNOWLEDGE_SECTION_LABELS: Record<(typeof WEBSITE_KNOWLEDGE_CATEGORIES)[number], string> = {
  company_overview: "Company Overview", mission_value_proposition: "Mission / Value Proposition",
  product: "Products", service: "Services", feature_capability: "Features & Capabilities",
  pricing_plan: "Pricing & Plans", customer_segment: "Customer Segments",
  industry_served: "Industries Served", primary_use_case: "Primary Use Cases",
  integration: "Integrations", ai_automation: "AI Features / Automation",
  technical_capability: "Technical Capabilities", security_compliance: "Security & Compliance",
  certification: "Certifications", support_onboarding: "Support & Onboarding",
  partnership: "Partnerships", location_service_area: "Locations / Service Areas",
  contact_information: "Contact Information", brand_voice_terminology: "Brand Voice / Terminology",
  faq: "Frequently Asked Questions", policy: "Policies",
  competitive_differentiator: "Competitive Differentiators",
  additional_business_knowledge: "Additional Business Knowledge",
  business_identity: "Company Overview", industry: "Industries Served", customer: "Customer Segments",
  pricing: "Pricing & Plans", process: "Support & Onboarding", differentiator: "Competitive Differentiators",
  guarantee: "Policies", location: "Locations / Service Areas", contact: "Contact Information",
  other: "Additional Business Knowledge",
};

export type WebsiteKnowledgeEvidence = { url: string; excerpt: string };

export type WebsiteKnowledgeFact = {
  category: (typeof WEBSITE_KNOWLEDGE_CATEGORIES)[number];
  title: string;
  value: string;
  confidence: (typeof WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS)[number];
  evidence: WebsiteKnowledgeEvidence[];
};

export type WebsiteKnowledgeCoverage = Record<
  (typeof WEBSITE_KNOWLEDGE_COVERAGE_FIELDS)[number],
  number
>;

export type StructuredWebsiteKnowledge = {
  facts: WebsiteKnowledgeFact[];
  coverage: WebsiteKnowledgeCoverage;
  unresolvedQuestions: string[];
};

export type WebsiteKnowledgePage = { url: string; title: string; pageType: string };

export type PersistedWebsiteKnowledge = {
  schema_version: 1;
  document_version: number;
  current_crawl_attempt_id: string | null;
  imported_at: string | null;
  requested_url: string | null;
  resolved_url: string | null;
  pages: WebsiteKnowledgePage[];
  warnings: string[];
  knowledge: StructuredWebsiteKnowledge;
};

import type {
  AiBuilderSession,
  BusinessContextCategory,
  BusinessContextStatus,
  ContextConfidence,
} from "../contracts";

const WEBSITE_FACT_CATEGORIES: Record<
  WebsiteKnowledgeFact["category"],
  BusinessContextCategory
> = {
  company_overview: "business_profile",
  mission_value_proposition: "business_profile",
  business_identity: "business_profile",
  industry: "business_profile",
  product: "service",
  service: "service",
  customer: "audience",
  pricing: "pricing",
  policy: "policy",
  process: "process",
  faq: "faq",
  differentiator: "differentiator",
  guarantee: "policy",
  location: "business_profile",
  contact: "business_profile",
  other: "business_profile",
  feature_capability: "service",
  pricing_plan: "pricing",
  customer_segment: "audience",
  industry_served: "audience",
  primary_use_case: "service",
  integration: "service",
  ai_automation: "service",
  technical_capability: "service",
  security_compliance: "policy",
  certification: "business_profile",
  support_onboarding: "process",
  partnership: "business_profile",
  location_service_area: "business_profile",
  contact_information: "business_profile",
  brand_voice_terminology: "business_profile",
  competitive_differentiator: "differentiator",
  additional_business_knowledge: "business_profile",
};

function normalizeFactIdentityValue(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Canonical restoration identity: category, title, value, and evidence URLs. */
export function websiteFactIdentityMaterial(fact: WebsiteKnowledgeFact): string {
  const evidenceUrls = fact.evidence
    .map((item) => normalizeFactIdentityValue(item.url))
    .filter(Boolean)
    .sort();
  return [fact.category, fact.title, fact.value, ...evidenceUrls]
    .map(normalizeFactIdentityValue)
    .join("\u0000");
}

/** Business Memory fingerprint: restoration identity plus every evidence excerpt. */
export function websiteFactFingerprint(fact: WebsiteKnowledgeFact): string {
  const evidence = fact.evidence
    .map((item) => `${item.url}\u0000${item.excerpt}`)
    .map(normalizeFactIdentityValue)
    .filter(Boolean)
    .sort();
  return [fact.category, fact.title, fact.value, ...evidence]
    .map(normalizeFactIdentityValue)
    .join("\u0000");
}

export function websiteFactIdentity(fact: WebsiteKnowledgeFact): string {
  const identity = websiteFactIdentityMaterial(fact);
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `website_fact_${(hash >>> 0).toString(16)}`;
}

/** Project-owned review row identity; prevents global child-key collisions. */
export function websiteFactReviewIdentity(projectId: string, fact: WebsiteKnowledgeFact): string {
  return `website_fact_${normalizeFactIdentityValue(projectId)}_${websiteFactIdentity(fact).slice("website_fact_".length)}`;
}

/** Stable FAQ identity derived from the same canonical website observation. */
export function websiteFaqIdentity(fact: WebsiteKnowledgeFact): string {
  return `website_faq_${websiteFactIdentity(fact).slice("website_fact_".length)}`;
}

function confidenceScore(confidence: ContextConfidence): number {
  return confidence === "high" ? 0.9 : confidence === "medium" ? 0.7 : 0.5;
}

type ApplyStructuredWebsiteKnowledgeOptions = {
  defaultStatus: BusinessContextStatus;
};

/**
 * Builds the durable website-review graph from crawler source data. Existing
 * records win verbatim, preserving every review decision and user correction.
 */
export function reconcileStructuredWebsiteKnowledge(
  session: AiBuilderSession,
  knowledge: StructuredWebsiteKnowledge | null | undefined,
  options: ApplyStructuredWebsiteKnowledgeOptions,
): AiBuilderSession {
  if (!knowledge?.facts.length) return session;

  const existingEntries = new Map(
    session.contextEntries.map((entry) => [entry.id, entry]),
  );
  // Never remove a persisted website row here: an archived/removed legacy row
  // is a review decision, not a cue to recreate or discard state.
  const retainedEntries = session.contextEntries;
  const createdAt = session.createdAt;

  const structuredEntries = knowledge.facts.flatMap((fact) => {
    const id = websiteFactReviewIdentity(session.id, fact);
    // Recognize historical unscoped rows so reopening an older project does
    // not create a second review item for the same observation.
    if (existingEntries.has(id) || existingEntries.has(websiteFactIdentity(fact))) return [];

    const evidence = fact.evidence[0];
    return [{
      id,
      sessionId: session.id,
      category: WEBSITE_FACT_CATEGORIES[fact.category],
      title: fact.title,
      content: fact.value,
      confidence: fact.confidence,
      confidenceScore: confidenceScore(fact.confidence),
      status: options.defaultStatus,
      source: {
        intakeBlockId: "website_knowledge",
        excerpt: evidence?.excerpt ?? fact.value,
        sourceType: "website" as const,
        sourceUrl: evidence?.url ?? null,
      },
      metadata: {
        generated: true,
        userEdited: false,
        conflictingEntryIds: [],
        tags: [fact.category],
        provenanceClassification: "website" as const,
      },
      createdAt,
      updatedAt: createdAt,
    }];
  });

  const contextEntries = retainedEntries.concat(structuredEntries);
  // Website FAQs are already independently reviewable context facts with full
  // evidence. Creating a second FAQ row would duplicate the review decision,
  // counters, Business Memory assertion, and runtime rendering.
  const structuredFaqEntries: AiBuilderSession["faqEntries"] = [];
  const faqEntries = session.faqEntries.concat(structuredFaqEntries);
  const faqSupportIds = new Set(faqEntries.flatMap((faq) => faq.sourceEntryIds));
  const reviewContextEntries = contextEntries.filter((entry) => !faqSupportIds.has(entry.id));
  const byCategory: AiBuilderSession["contextCounts"]["byCategory"] = {};
  reviewContextEntries.forEach((entry) => {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  });

  return {
    ...session,
    contextEntries,
    faqEntries,
    contextCounts: {
      total: reviewContextEntries.length + faqEntries.length,
      approved: reviewContextEntries.filter(
        (entry) => entry.status === "approved" || entry.status === "corrected",
      ).length + faqEntries.filter((entry) => entry.status === "approved" || entry.status === "corrected").length,
      proposed: reviewContextEntries.filter((entry) => entry.status === "proposed").length + faqEntries.filter((entry) => entry.status === "proposed").length,
      archived:
        reviewContextEntries.filter((entry) => entry.status === "archived").length +
        faqEntries.filter((entry) => entry.status === "archived").length,
      byCategory,
    },
  };
}

/** @deprecated Browser restoration must not create review records. Kept only for compatibility. */
export const applyStructuredWebsiteKnowledge = reconcileStructuredWebsiteKnowledge;
