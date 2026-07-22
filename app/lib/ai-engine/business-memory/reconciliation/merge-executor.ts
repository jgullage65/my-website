import { canonicalJson, resolveRedirect, validateMerge, type EntityAlias, type IdentityKey, type MergeCommand, type Redirect, type ResolvedEntity } from "./entity-reconciliation";
import { detectAssertionConflicts, type AssertionConflict, type ConflictAssertion } from "./conflicting-assertions";
import { rewireRelationships, type BusinessRelationship } from "./relationship-rewiring";

export type Ownership = { id: string; sourceEntityId?: string; assertionId?: string; resolvedEntityId: string };
export type ConflictAssertionLink = { conflictId: string; assertionId: string };
export type MergeHistory = { id: string; commandId: string; survivorId: string; mergedIds: string[]; createdAt: string };
export type MergeResult = { commandId: string; survivorId: string; mergedIds: string[]; startingRevision: number; resultingRevision: number; changedIds: Record<string, string[]>; redirectsCreated: Redirect[]; conflictsCreatedOrUpdated: string[]; relationshipsRewired: string[]; executedAt: string; disposition: "executed" | "replayed" };
export type MergeState = { projectId: string; businessMemoryId?: string; revision: number; entities: ResolvedEntity[]; redirects: Redirect[]; aliases: EntityAlias[]; identityKeys: IdentityKey[]; relationships: BusinessRelationship[]; sourceEntityOwnership?: Ownership[]; assertionOwnership?: Ownership[]; assertions?: ConflictAssertion[]; conflicts?: AssertionConflict[]; conflictAssertionLinks?: ConflictAssertionLink[]; sourceLinks?: unknown[]; evidenceLinks?: unknown[]; mergeHistory?: MergeHistory[]; mergeCommandLedger?: Record<string, unknown> };
export interface MergeTransaction { find(commandId: string): Promise<{ command: MergeCommand; result: MergeResult } | null>; load(projectId: string): Promise<MergeState>; save(state: MergeState, result: MergeResult): Promise<void>; }
export interface MergeStore { transaction<T>(commandId: string, callback: (transaction: MergeTransaction) => Promise<T>): Promise<T>; }

const unique = (values: string[]) => Array.from(new Set(values)).sort();
function flattenRedirects(existing: Redirect[], merged: string[], survivorId: string): Redirect[] {
  const map = new Map(existing.map(x => [x.fromResolvedEntityId, x.toResolvedEntityId]));
  for (const id of merged) map.set(id, survivorId);
  // Resolve all original and newly merged sources through the complete graph. This
  // both detects cycles and ensures no redirect terminates at a merged entity.
  return Array.from(map.keys()).sort().map(fromResolvedEntityId => ({ fromResolvedEntityId, toResolvedEntityId: resolveRedirect(fromResolvedEntityId, Array.from(map, ([fromResolvedEntityId, toResolvedEntityId]) => ({ fromResolvedEntityId, toResolvedEntityId }))) }))
    .filter(x => x.fromResolvedEntityId !== x.toResolvedEntityId);
}
function dedupeAliases(aliases: EntityAlias[]): EntityAlias[] {
  const groups = new Map<string, EntityAlias[]>();
  for (const row of aliases) { const key = `${row.projectId}\u0000${row.resolvedEntityId}\u0000${row.normalizedValue}`; groups.set(key, [...(groups.get(key) ?? []), row]); }
  return Array.from(groups.values()).map(group => { const survivor = [...group].sort((a,b) => a.id.localeCompare(b.id))[0]; return { ...survivor, sourceIds: unique(group.flatMap(x => x.sourceIds)), accepted: group.some(x => x.accepted) }; }).sort((a,b) => a.id.localeCompare(b.id));
}
function dedupeKeys(keys: IdentityKey[]): IdentityKey[] {
  const groups = new Map<string, IdentityKey[]>();
  for (const row of keys) { const key = `${row.projectId}\u0000${row.resolvedEntityId}\u0000${row.type}\u0000${row.normalizedValue}\u0000${row.sourceEntityId ?? ""}`; groups.set(key, [...(groups.get(key) ?? []), row]); }
  return Array.from(groups.values()).map(group => { const survivor = [...group].sort((a,b) => a.id.localeCompare(b.id))[0]; return { ...survivor, sourceIds: unique(group.flatMap(x => x.sourceIds)), authoritative: group.some(x => x.authoritative), strength: (group.some(x => x.strength === "strong") ? "strong" : "weak") as IdentityKey["strength"], active: group.some(x => x.active !== false) }; }).sort((a,b) => a.id.localeCompare(b.id));
}

export class MergeExecutor {
  private readonly store: MergeStore;
  private readonly now: () => Date;
  constructor(store: MergeStore, now: () => Date = () => new Date()) { this.store = store; this.now = now; }
  async execute(command: MergeCommand): Promise<MergeResult> { return this.store.transaction(command.commandId, async tx => {
    const committed = await tx.find(command.commandId);
    if (committed) { if (canonicalJson(committed.command) !== canonicalJson(command)) throw new Error("business_memory_merge_command_content_conflict"); return { ...committed.result, disposition: "replayed" }; }
    const state = await tx.load(command.projectId); validateMerge(command, state.revision, state.entities, state.redirects);
    const survivorId = resolveRedirect(command.survivorResolvedEntityId, state.redirects);
    const mergedIds = unique(command.mergedResolvedEntityIds.map(id => resolveRedirect(id, state.redirects)).filter(id => id !== survivorId));
    const strong = new Map<string, string>();
    for (const key of state.identityKeys.filter(k => k.active !== false && k.strength === "strong" && k.authoritative)) { const owner = mergedIds.includes(key.resolvedEntityId) ? survivorId : resolveRedirect(key.resolvedEntityId, state.redirects); const name = `${key.type}:${key.normalizedValue}`; if (strong.has(name) && strong.get(name)! !== owner) throw new Error("business_memory_conflicting_strong_identity_key"); strong.set(name, owner); }
    const redirects = flattenRedirects(state.redirects, mergedIds, survivorId);
    const entities = state.entities.map(entity => mergedIds.includes(entity.id) ? { ...entity, active: false } : entity.id === survivorId ? { ...entity, sourceEntityIds: unique(state.entities.filter(x => x.id === survivorId || mergedIds.includes(x.id)).flatMap(x => x.sourceEntityIds)) } : entity);
    const aliases = dedupeAliases(state.aliases.map(x => mergedIds.includes(x.resolvedEntityId) ? { ...x, resolvedEntityId: survivorId } : x));
    const identityKeys = dedupeKeys(state.identityKeys.map(x => mergedIds.includes(x.resolvedEntityId) ? { ...x, resolvedEntityId: survivorId } : x));
    const sourceEntityOwnership = state.sourceEntityOwnership?.map(x => mergedIds.includes(x.resolvedEntityId) ? { ...x, resolvedEntityId: survivorId } : x);
    const assertionOwnership = state.assertionOwnership?.map(x => mergedIds.includes(x.resolvedEntityId) ? { ...x, resolvedEntityId: survivorId } : x);
    const assertions = state.assertions?.map(x => mergedIds.includes(x.resolvedEntityId) ? { ...x, resolvedEntityId: survivorId } : x);
    const relationshipResult = rewireRelationships(state.relationships, redirects, this.now);
    const conflicts = assertions ? detectAssertionConflicts(state.businessMemoryId ?? state.projectId, assertions, state.conflicts) : state.conflicts;
    const conflictAssertionLinks = conflicts ? conflicts.flatMap(c => c.assertionIds.map(assertionId => ({ conflictId: c.id, assertionId }))).sort((a,b) => canonicalJson(a).localeCompare(canonicalJson(b))) : state.conflictAssertionLinks;
    const resultingRevision = state.revision + 1, executedAt = this.now().toISOString();
    const changed = (before: {id:string}[], after: {id:string}[]) => unique([...before.filter(x => canonicalJson(x) !== canonicalJson(after.find(y => y.id === x.id))).map(x => x.id), ...after.filter(x => !before.some(y => y.id === x.id)).map(x => x.id)]);
    const result: MergeResult = { commandId: command.commandId, survivorId, mergedIds, startingRevision: state.revision, resultingRevision, changedIds: { resolvedEntities: unique([survivorId, ...mergedIds]), aliases: changed(state.aliases, aliases), identityKeys: changed(state.identityKeys, identityKeys), sourceEntityOwnership: sourceEntityOwnership ? changed(state.sourceEntityOwnership ?? [], sourceEntityOwnership) : [], assertionOwnership: assertionOwnership ? changed(state.assertionOwnership ?? [], assertionOwnership) : [], assertions: assertions ? changed(state.assertions ?? [], assertions) : [], relationships: relationshipResult.changedIds, removedRelationships: relationshipResult.removedIds, conflicts: conflicts ? changed(state.conflicts ?? [], conflicts) : [] }, redirectsCreated: redirects.filter(x => mergedIds.includes(x.fromResolvedEntityId)), conflictsCreatedOrUpdated: conflicts ? changed(state.conflicts ?? [], conflicts) : [], relationshipsRewired: relationshipResult.changedIds, executedAt, disposition: "executed" };
    await tx.save({ ...state, revision: resultingRevision, entities, redirects, aliases, identityKeys, sourceEntityOwnership, assertionOwnership, assertions, relationships: relationshipResult.relationships, conflicts, conflictAssertionLinks, mergeHistory: [...(state.mergeHistory ?? []), { id: `business_merge_history:${command.commandId}`, commandId: command.commandId, survivorId, mergedIds, createdAt: executedAt }] }, result);
    return result;
  }); }
}
