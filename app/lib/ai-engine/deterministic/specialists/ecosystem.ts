import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewEcosystem: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("ecosystem", observations, facts);
