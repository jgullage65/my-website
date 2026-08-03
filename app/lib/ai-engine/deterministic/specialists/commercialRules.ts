import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewCommercialRules: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("commercial_rules", observations, facts);
