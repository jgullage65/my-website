import { detectDrift, type DriftCategory, type DriftItem, type ReconciliationState } from "./entity-reconciliation";
import type { TypedRepairOperation } from "./repair-executor";
export { detectDrift };
const unreachable = (value: never): never => { throw new Error(`business_memory_unknown_drift_category:${value}`); };
function operationFor(category: DriftCategory): TypedRepairOperation["type"] { switch (category) {
 case "missing_row": return "insertResolvedEntity"; case "unexpected_row": return "deactivateResolvedEntity"; case "stale_field": return "updateResolvedEntity";
 case "wrong_entity_ownership": return "assignSourceEntityOwner"; case "broken_redirect": return "repairRedirect"; case "redirect_cycle": throw new Error("business_memory_unrepairable_drift");
 case "stale_identity_key": return "updateIdentityKey"; case "conflicting_identity_key_ownership": throw new Error("business_memory_unrepairable_drift");
 case "missing_alias": return "insertAlias"; case "stale_alias": return "updateAlias"; case "duplicate_entity": return "deactivateResolvedEntity";
 case "stale_assertion_owner": return "assignAssertionOwner"; case "missing_relationship": return "rewireRelationship"; case "stale_relationship_endpoint": return "rewireRelationship";
 case "duplicate_relationship": return "collapseDuplicateRelationship"; case "missing_conflict": return "insertConflict"; case "stale_conflict": return "updateConflict";
 case "source_evidence_lineage_mismatch": return "repairEvidenceLink"; case "revision_fingerprint_mismatch": return "synchronizeFingerprint";
 default: return unreachable(category);
} }
const ranks: Record<TypedRepairOperation["type"], number> = { insertResolvedEntity: 0, updateResolvedEntity: 1, deactivateResolvedEntity: 20, assignSourceEntityOwner: 2, assignAssertionOwner: 3, insertIdentityKey: 4, updateIdentityKey: 5, deactivateIdentityKey: 21, insertAlias: 6, updateAlias: 7, preserveAcceptedAlias: 8, insertRedirect: 9, repairRedirect: 10, rewireRelationship: 11, collapseDuplicateRelationship: 12, insertConflict: 13, updateConflict: 14, deactivateConflict: 22, replaceConflictAssertionLinks: 15, repairSourceLink: 16, repairEvidenceLink: 17, synchronizeTrustedKnowledgeRevision: 18, synchronizeFingerprint: 99 };
export function buildTypedRepairPlan(drift: DriftItem[]): TypedRepairOperation[] { if (drift.some(x => !x.repairable)) throw new Error("business_memory_unrepairable_drift"); return drift.map(item => ({ type: operationFor(item.category), id: item.id, payload: item.expected })).sort((a,b) => ranks[a.type] - ranks[b.type] || a.id.localeCompare(b.id)); }
export const detectAndPlan = (desired: ReconciliationState, persisted: ReconciliationState) => buildTypedRepairPlan(detectDrift(desired, persisted));
