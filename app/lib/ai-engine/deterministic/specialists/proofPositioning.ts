import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewProofPositioning: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("proof_positioning", observations, facts);
