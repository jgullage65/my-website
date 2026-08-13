import type { DeterministicFact } from "./contracts";
import type { BucketShadowDiagnostics } from "./integration/contracts";
import { reportsToLegacyFacts } from "./legacy/factAdapter";
import { routeLegacyFactsAsObservations } from "./routing/router";
import { runCompatibilitySpecialists } from "./specialists";

export function buildBucketShadowArchitecture(
  legacyFacts: readonly DeterministicFact[],
): {
  extracted: DeterministicFact[];
  diagnostics: BucketShadowDiagnostics;
} {
  const observations = routeLegacyFactsAsObservations(legacyFacts);
  const reports = runCompatibilitySpecialists(observations, legacyFacts);
  const extracted = reportsToLegacyFacts(reports, observations, legacyFacts);

  return {
    extracted,
    diagnostics: {
      observations,
      reports,
    },
  };
}
