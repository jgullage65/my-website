import type { SpecialistAdapter } from "./contracts";
import { buildCompatibilityBucketReport } from "./compatibilityAdapter";

export const reviewCustomersMarket: SpecialistAdapter = (observations, facts) =>
  buildCompatibilityBucketReport("customers_market", observations, facts);
