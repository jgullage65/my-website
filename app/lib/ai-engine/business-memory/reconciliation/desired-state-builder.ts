import { canonicalJson, stableHash, type ReconciliationState } from "./entity-reconciliation";
import { detectAssertionConflicts, type AssertionConflict, type ConflictAssertion } from "./conflicting-assertions";

/** Compatibility boundary for callers which build desired state before loading it.
 * Reconciliation itself has exactly one state contract: ReconciliationState. */
export type DesiredBusinessMemoryState = ReconciliationState;
export function buildDesiredBusinessMemoryState(input: Omit<ReconciliationState, "fingerprint" | "conflicts"> & { businessMemoryId: string; assertions: ConflictAssertion[]; conflictResolutions?: AssertionConflict[] }): ReconciliationState {
  const { businessMemoryId, assertions, conflictResolutions, ...rest } = input;
  const conflicts = detectAssertionConflicts(businessMemoryId, assertions, conflictResolutions);
  const state = { ...rest, conflicts } as Omit<ReconciliationState, "fingerprint">;
  for (const [key, value] of Object.entries(state)) if (Array.isArray(value)) (state as any)[key] = [...value].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  return { ...state, fingerprint: stableHash(state) };
}
