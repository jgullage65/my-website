import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewOperationsExperience: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("operations_experience", observations, facts);
