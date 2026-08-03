import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewOffersCapabilities: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("offers_capabilities", observations, facts);
