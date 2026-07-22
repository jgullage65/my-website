import { canonicalJson, stableHash, type EntityAlias, type IdentityKey, type Redirect, type ResolvedEntity, type SourceEntity } from "./entity-reconciliation";
import { detectAssertionConflicts, type AssertionConflict, type ConflictAssertion } from "./conflicting-assertions";
import type { BusinessRelationship } from "./relationship-rewiring";
export type DesiredBusinessMemoryState = { sourceEntities: SourceEntity[]; resolvedEntities: ResolvedEntity[]; assertionOwners: { assertionId: string; resolvedEntityId: string }[]; identityKeys: IdentityKey[]; aliases: EntityAlias[]; redirects: Redirect[]; relationships: BusinessRelationship[]; conflicts: AssertionConflict[]; sources: unknown[]; evidence: unknown[]; assertionSourceLinks: unknown[]; assertionEvidenceLinks: unknown[]; materialFingerprint: string; trustedKnowledgeRevision: number; businessMemoryRevision: number };
/** Input is canonical/durable data loaded by the server store, never browser state.
 * The memory identity is part of conflict identity, preventing cross-memory IDs. */
export function buildDesiredBusinessMemoryState(input: Omit<DesiredBusinessMemoryState, "materialFingerprint" | "conflicts"> & { businessMemoryId: string; assertions: ConflictAssertion[]; conflictResolutions?: AssertionConflict[] }): DesiredBusinessMemoryState {
 const sort = <T>(items: T[]) => [...items].sort((a,b) => canonicalJson(a).localeCompare(canonicalJson(b)));
 const conflicts = detectAssertionConflicts(input.businessMemoryId, input.assertions, input.conflictResolutions);
 const { businessMemoryId: _businessMemoryId, conflictResolutions: _conflictResolutions, assertions: _assertions, ...raw } = input;
 const state = { ...raw, sourceEntities: sort(input.sourceEntities), resolvedEntities: sort(input.resolvedEntities), assertionOwners: sort(input.assertionOwners), identityKeys: sort(input.identityKeys), aliases: sort(input.aliases), redirects: sort(input.redirects), relationships: sort(input.relationships), conflicts, sources: sort(input.sources), evidence: sort(input.evidence), assertionSourceLinks: sort(input.assertionSourceLinks), assertionEvidenceLinks: sort(input.assertionEvidenceLinks) };
 return { ...state, materialFingerprint: stableHash(state) };
}
