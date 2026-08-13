import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { DeterministicFact } from "./contracts";

export type KnowledgeOwnerId =
  | "business_identity"
  | "commercial"
  | "market_customer"
  | "proof_authority"
  | "operations_context";

export type KnowledgeOwnerContract = {
  id: KnowledgeOwnerId;
  label: string;
  categories: readonly WebsiteKnowledgeFact["category"][];
};

export const KNOWLEDGE_OWNER_CONTRACTS: readonly KnowledgeOwnerContract[] = [
  {
    id: "business_identity",
    label: "Business & Identity",
    categories: [
      "business_identity",
      "company_overview",
      "contact_information",
      "contact",
      "location_service_area",
      "location",
      "certification",
      "partnership",
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    categories: [
      "product",
      "service",
      "pricing_plan",
      "pricing",
      "feature_capability",
      "integration",
      "ai_automation",
      "technical_capability",
    ],
  },
  {
    id: "market_customer",
    label: "Market & Customer",
    categories: [
      "customer_segment",
      "customer",
      "industry_served",
      "industry",
      "primary_use_case",
      "mission_value_proposition",
      "brand_voice_terminology",
    ],
  },
  {
    id: "proof_authority",
    label: "Proof & Authority",
    categories: [
      "competitive_differentiator",
      "differentiator",
      "additional_business_knowledge",
    ],
  },
  {
    id: "operations_context",
    label: "Operations & Context",
    categories: [
      "faq",
      "policy",
      "guarantee",
      "process",
      "security_compliance",
      "support_onboarding",
      "other",
    ],
  },
] as const;

const OWNER_BY_CATEGORY = new Map<WebsiteKnowledgeFact["category"], KnowledgeOwnerId>();
for (const contract of KNOWLEDGE_OWNER_CONTRACTS) {
  for (const category of contract.categories) OWNER_BY_CATEGORY.set(category, contract.id);
}

export function ownerForCategory(category: WebsiteKnowledgeFact["category"]): KnowledgeOwnerId {
  return OWNER_BY_CATEGORY.get(category) ?? "operations_context";
}

export type OwnedDeterministicFact = DeterministicFact & {
  ownerId: KnowledgeOwnerId;
};

export function attachKnowledgeOwner(fact: DeterministicFact): OwnedDeterministicFact {
  return { ...fact, ownerId: ownerForCategory(fact.category) };
}
