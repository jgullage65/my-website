import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewBusinessIdentity: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("business_identity", observations, facts);
