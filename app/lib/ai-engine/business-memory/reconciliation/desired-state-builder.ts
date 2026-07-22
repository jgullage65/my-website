import { canonicalJson, stableHash, type EntityAlias, type IdentityKey, type Redirect, type ResolvedEntity, type SourceEntity } from "./entity-reconciliation";
import { detectAssertionConflicts, type AssertionConflict, type ConflictAssertion } from "./conflicting-assertions";
import type { BusinessRelationship } from "./relationship-rewiring";
export type DesiredBusinessMemoryState = { sourceEntities: SourceEntity[]; resolvedEntities: ResolvedEntity[]; assertionOwners: { assertionId: string; resolvedEntityId: string }[]; identityKeys: IdentityKey[]; aliases: EntityAlias[]; redirects: Redirect[]; relationships: BusinessRelationship[]; conflicts: AssertionConflict[]; sources: unknown[]; evidence: unknown[]; assertionSourceLinks: unknown[]; assertionEvidenceLinks: unknown[]; materialFingerprint: string; trustedKnowledgeRevision: number; businessMemoryRevision: number };
export function buildDesiredBusinessMemoryState(input: Omit<DesiredBusinessMemoryState, "materialFingerprint" | "conflicts"> & { assertions: ConflictAssertion[]; conflictResolutions?: AssertionConflict[] }): DesiredBusinessMemoryState {
 const sort = <T>(items: T[]) => [...items].sort((a,b) => canonicalJson(a).localeCompare(canonicalJson(b)));
 const conflicts = detectAssertionConflicts("memory", input.assertions, input.conflictResolutions);
 const state = { ...input, sourceEntities: sort(input.sourceEntities), resolvedEntities: sort(input.resolvedEntities), assertionOwners: sort(input.assertionOwners), identityKeys: sort(input.identityKeys), aliases: sort(input.aliases), redirects: sort(input.redirects), relationships: sort(input.relationships), conflicts, sources: sort(input.sources), evidence: sort(input.evidence), assertionSourceLinks: sort(input.assertionSourceLinks), assertionEvidenceLinks: sort(input.assertionEvidenceLinks) };
 return { ...state, materialFingerprint: stableHash(state) };
}
