import { KNOWLEDGE_BUCKETS } from "../routing/buckets";
import type { KnowledgeBucket, KnowledgeObservation } from "../routing/contracts";
import type { DeterministicFact } from "../contracts";
import { reviewBusinessIdentity } from "./businessIdentity";
import { reviewCommercialRules } from "./commercialRules";
import { reviewCustomersMarket } from "./customersMarket";
import { reviewEcosystem } from "./ecosystem";
import { reviewOffersCapabilities } from "./offersCapabilities";
import { reviewOperationsExperience } from "./operationsExperience";
import { reviewProofPositioning } from "./proofPositioning";
import { reviewTrustQualification } from "./trustQualification";
import type { BucketReport, SpecialistAdapter } from "./contracts";

export const SPECIALIST_ADAPTERS = {
  business_identity: reviewBusinessIdentity,
  offers_capabilities: reviewOffersCapabilities,
  customers_market: reviewCustomersMarket,
  commercial_rules: reviewCommercialRules,
  trust_qualification: reviewTrustQualification,
  operations_experience: reviewOperationsExperience,
  ecosystem: reviewEcosystem,
  proof_positioning: reviewProofPositioning,
} as const satisfies Readonly<Record<KnowledgeBucket, SpecialistAdapter>>;

export function runCompatibilitySpecialists(
  observations: readonly KnowledgeObservation[],
  legacyFacts: readonly DeterministicFact[],
): BucketReport[] {
  return KNOWLEDGE_BUCKETS.map((bucket) =>
    SPECIALIST_ADAPTERS[bucket](observations, legacyFacts),
  );
}
