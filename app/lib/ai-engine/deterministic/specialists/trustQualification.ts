import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewTrustQualification: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("trust_qualification", observations, facts);
