import "server-only";

/** Only an exact, canonical MATCH can authorize a projection for chat serving. */
export const ACCEPTED_ASSISTANT_PROJECTION_PARITY_STATUSES = ["MATCH"] as const;

export type AssistantProjectionCutoverEvidence = {
  status: unknown;
  projectionVersion: unknown;
  schemaVersion: unknown;
  activeRuntimeAuthority: unknown;
  comparedAt: unknown;
};

export type AssistantProjectionCutoverArtifact = {
  projectionVersion: number;
  schemaVersion: number;
  generatedAt: string;
};

/**
 * This is intentionally a pure policy boundary so offline migration/rebuild
 * tooling can apply the same rule before activating a project. A valid
 * artifact represents no newer Business Memory mutation: mutations must mark
 * the artifact invalidated before they can be served.
 */
export function cutoverEligibilityFailure(input: {
  runtimeAuthority: unknown;
  artifact: AssistantProjectionCutoverArtifact;
  evidence: AssistantProjectionCutoverEvidence | null;
}): string | null {
  if (input.runtimeAuthority !== "canonical") return "assistant_projection_migration_required";
  if (!input.evidence) return "assistant_projection_runtime_unavailable_parity_evidence_unavailable";
  if (input.evidence.status !== "MATCH") return "assistant_projection_runtime_unavailable_parity_status_unacceptable";
  if (input.evidence.activeRuntimeAuthority !== "canonical") return "assistant_projection_runtime_unavailable_parity_authority_invalid";
  if (input.evidence.projectionVersion !== input.artifact.projectionVersion || input.evidence.schemaVersion !== input.artifact.schemaVersion) return "assistant_projection_runtime_unavailable_parity_evidence_stale";
  const comparedAt = new Date(String(input.evidence.comparedAt)).getTime();
  const generatedAt = new Date(input.artifact.generatedAt).getTime();
  if (!Number.isFinite(comparedAt) || !Number.isFinite(generatedAt) || comparedAt < generatedAt) return "assistant_projection_runtime_unavailable_parity_evidence_stale";
  return null;
}
