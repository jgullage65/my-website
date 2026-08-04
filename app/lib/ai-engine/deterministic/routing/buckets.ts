import { WEBSITE_KNOWLEDGE_CATEGORIES } from "../../knowledge/websiteKnowledge";
import type { KnowledgeBucket, KnowledgeCategory } from "./contracts";

export const KNOWLEDGE_BUCKETS = [
  "business_identity",
  "offers_capabilities",
  "customers_market",
  "commercial_rules",
  "trust_qualification",
  "operations_experience",
  "ecosystem",
  "proof_positioning",
] as const satisfies readonly KnowledgeBucket[];

export const CATEGORY_PRIMARY_BUCKET = {
  company_overview: "business_identity",
  mission_value_proposition: "business_identity",
  business_identity: "business_identity",
  brand_voice_terminology: "business_identity",

  product: "offers_capabilities",
  service: "offers_capabilities",
  feature_capability: "offers_capabilities",
  primary_use_case: "offers_capabilities",
  ai_automation: "offers_capabilities",
  technical_capability: "offers_capabilities",

  industry: "customers_market",
  customer: "customers_market",
  customer_segment: "customers_market",
  industry_served: "customers_market",
  location: "customers_market",
  location_service_area: "customers_market",

  pricing: "commercial_rules",
  pricing_plan: "commercial_rules",
  policy: "commercial_rules",
  guarantee: "commercial_rules",

  security_compliance: "trust_qualification",
  certification: "trust_qualification",

  process: "operations_experience",
  support_onboarding: "operations_experience",
  contact: "operations_experience",
  contact_information: "operations_experience",

  integration: "ecosystem",
  partnership: "ecosystem",

  faq: "proof_positioning",
  differentiator: "proof_positioning",
  competitive_differentiator: "proof_positioning",
  additional_business_knowledge: "proof_positioning",
  other: "proof_positioning",
} as const satisfies Record<KnowledgeCategory, KnowledgeBucket>;

const CATEGORY_SET = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);
const BUCKET_SET = new Set<string>(KNOWLEDGE_BUCKETS);

export function primaryBucketForCategory(
  category: KnowledgeCategory,
): KnowledgeBucket {
  const bucket = CATEGORY_PRIMARY_BUCKET[category];
  if (!bucket) {
    throw new Error(`Unknown knowledge category: ${String(category)}`);
  }
  return bucket;
}

export function assertExhaustiveCategoryOwnership(): void {
  const mappedCategories = Object.keys(CATEGORY_PRIMARY_BUCKET);

  for (const category of WEBSITE_KNOWLEDGE_CATEGORIES) {
    if (!Object.prototype.hasOwnProperty.call(CATEGORY_PRIMARY_BUCKET, category)) {
      throw new Error(`Missing primary bucket owner for category: ${category}`);
    }
  }

  for (const category of mappedCategories) {
    if (!CATEGORY_SET.has(category)) {
      throw new Error(`Unexpected mapped knowledge category: ${category}`);
    }

    const bucket = CATEGORY_PRIMARY_BUCKET[category as KnowledgeCategory];
    if (!BUCKET_SET.has(bucket)) {
      throw new Error(
        `Invalid primary bucket ${bucket} for category: ${category}`,
      );
    }
  }

  if (mappedCategories.length !== WEBSITE_KNOWLEDGE_CATEGORIES.length) {
    throw new Error(
      `Knowledge category ownership count ${mappedCategories.length} does not match expected ${WEBSITE_KNOWLEDGE_CATEGORIES.length}`,
    );
  }
}
