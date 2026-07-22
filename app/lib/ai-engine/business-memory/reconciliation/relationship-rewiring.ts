import { canonicalJson, resolveRedirect } from "./entity-reconciliation";

export type BusinessRelationship = { id: string; relationshipType: string; fromResolvedEntityId: string; toResolvedEntityId: string; fromAssertionId: string; toAssertionId: string; sourceEntryIds: string[]; provenance: string[]; createdAt: string; updatedAt: string; allowsSelfLink?: boolean };
export const substituteResolvedEndpoint = (id: string, redirects: { fromResolvedEntityId: string; toResolvedEntityId: string }[]) => resolveRedirect(id, redirects);
export const isRelationshipSelfLinkAllowed = (relationship: Pick<BusinessRelationship, "relationshipType" | "allowsSelfLink">) => relationship.allowsSelfLink === true;
export const unionSourceEntryIds = (relationships: Pick<BusinessRelationship, "sourceEntryIds">[]) => Array.from(new Set(relationships.flatMap(x => x.sourceEntryIds))).sort();
export const groupDuplicateRelationships = (relationships: BusinessRelationship[]) => {
  const groups = new Map<string, BusinessRelationship[]>();
  for (const relationship of relationships) {
    const key = canonicalJson({ relationshipType: relationship.relationshipType, from: relationship.fromResolvedEntityId, to: relationship.toResolvedEntityId, fromAssertionId: relationship.fromAssertionId, toAssertionId: relationship.toAssertionId });
    groups.set(key, [...(groups.get(key) ?? []), relationship]);
  }
  return Array.from(groups.values()).map(group => group.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))).sort((a, b) => a[0].id.localeCompare(b[0].id));
};
export const chooseRelationshipSurvivor = (relationships: BusinessRelationship[]) => [...relationships].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
export function rewireRelationships(relationships: BusinessRelationship[], redirects: { fromResolvedEntityId: string; toResolvedEntityId: string }[]): { relationships: BusinessRelationship[]; removedIds: string[]; changedIds: string[] } {
  const rewired = relationships.flatMap((relationship) => {
    const fromResolvedEntityId = substituteResolvedEndpoint(relationship.fromResolvedEntityId, redirects);
    const toResolvedEntityId = substituteResolvedEndpoint(relationship.toResolvedEntityId, redirects);
    if (fromResolvedEntityId === toResolvedEntityId && !isRelationshipSelfLinkAllowed(relationship)) return [];
    return [{ ...relationship, fromResolvedEntityId, toResolvedEntityId }];
  });
  const output: BusinessRelationship[] = [], removedIds: string[] = [], changedIds = new Set<string>();
  for (const group of groupDuplicateRelationships(rewired)) {
    const survivor = chooseRelationshipSurvivor(group);
    const merged = { ...survivor, sourceEntryIds: unionSourceEntryIds(group), provenance: Array.from(new Set(group.flatMap(x => x.provenance))).sort(), createdAt: group[0].createdAt };
    if (canonicalJson(merged) !== canonicalJson(survivor)) changedIds.add(survivor.id);
    for (const item of group.slice(1)) removedIds.push(item.id);
    if (canonicalJson(merged) !== canonicalJson(relationships.find(x => x.id === survivor.id))) changedIds.add(survivor.id);
    output.push(merged);
  }
  return { relationships: output.sort((a, b) => a.id.localeCompare(b.id)), removedIds: removedIds.sort(), changedIds: Array.from(changedIds).sort() };
}
