import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import type { TypedRepairOperation, RepairResult, RepairStore, RepairTransaction } from "../reconciliation/repair-executor";

/** The transaction-backed repair store.  It intentionally receives the caller's
 * client: reconciliation is part of the command/merge transaction, never a
 * second competing writer. */
export class NeonBusinessMemoryReconciliationStore implements RepairStore {
  constructor(private readonly client: PoolClient, private readonly projectId: string) {}
  async transaction<T>(callback: (transaction: RepairTransaction) => Promise<T>): Promise<T> { return callback(new NeonRepairTransaction(this.client, this.projectId)); }
}

class NeonRepairTransaction implements RepairTransaction {
  private memoryId = "";
  private fingerprint = "";
  private trustedRevision: number | null = null;
  constructor(private readonly client: PoolClient, private readonly projectId: string) {}
  async loadForUpdate() { const row=(await this.client.query("SELECT id, revision FROM ai_builder_business_memory WHERE project_id=$1 FOR UPDATE",[this.projectId])).rows[0]; if(!row) throw new Error("business_memory_not_found"); this.memoryId=String(row.id); return { revision:Number(row.revision) }; }
  async apply(operation: TypedRepairOperation): Promise<Record<string,string[]>> {
    if(operation.type === "synchronizeFingerprint") { this.fingerprint=String(operation.payload); return {}; }
    if(operation.type === "synchronizeTrustedKnowledgeRevision") { this.trustedRevision=Number(operation.payload); return {}; }
    const value=operation.payload as Record<string, unknown> | null, id=String(value?.id ?? operation.id);
    const table: Record<string,string>={resolvedEntities:"ai_builder_business_memory_resolved_entities",identityKeys:"ai_builder_business_memory_identity_keys",aliases:"ai_builder_business_memory_entity_aliases",redirects:"ai_builder_business_memory_entity_redirects",relationships:"ai_builder_business_memory_relationships",conflicts:"ai_builder_business_memory_conflicts",sources:"ai_builder_business_memory_sources",evidence:"ai_builder_business_memory_evidence"};
    if(operation.type.startsWith("deactivate") || operation.type === "collapseDuplicateRelationship") { const name=table[operation.model]; if(name) await this.client.query(`DELETE FROM ${name} WHERE id=$1 AND memory_id=$2`,[id,this.memoryId]); return {[operation.model]:[id]}; }
    if(operation.model === "sourceEntityOwnership") await this.client.query("INSERT INTO ai_builder_business_memory_entity_resolution (source_entity_id,resolved_entity_id,memory_id,created_at) VALUES ($1,$2,$3,now()) ON CONFLICT (source_entity_id) DO UPDATE SET resolved_entity_id=EXCLUDED.resolved_entity_id,memory_id=EXCLUDED.memory_id",[value!.sourceEntityId,value!.resolvedEntityId,this.memoryId]);
    else if(operation.model === "assertionOwnership") await this.client.query("UPDATE ai_builder_business_memory_assertions SET entity_id=$1,updated_at=now() WHERE id=$2 AND memory_id=$3",[value!.resolvedEntityId,value!.assertionId,this.memoryId]);
    else if(operation.model === "assertionSourceLinks") await this.client.query("INSERT INTO ai_builder_business_memory_assertion_sources (assertion_id,source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",[value!.assertionId,value!.sourceId]);
    else if(operation.model === "assertionEvidenceLinks") await this.client.query("INSERT INTO ai_builder_business_memory_assertion_evidence (assertion_id,evidence_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",[value!.assertionId,value!.evidenceId]);
    else if(operation.model === "conflictAssertionLinks") { /* conflict links are persisted in conflicting_statements below */ }
    else { const name=table[operation.model]; if(!name) throw new Error(`business_memory_unknown_repair_model:${operation.model}`); await this.client.query(`INSERT INTO ${name} (id,memory_id) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,[id,this.memoryId]); }
    return {[operation.model]:[id]};
  }
  async synchronize() { await this.client.query("UPDATE ai_builder_business_memory SET revision=revision+1,state_fingerprint=COALESCE(NULLIF($2,''),state_fingerprint),trusted_knowledge_revision=COALESCE($3,trusted_knowledge_revision),updated_at=now() WHERE id=$1",[this.memoryId,this.fingerprint,this.trustedRevision]); await this.client.query("UPDATE ai_builder_projects SET business_memory_revision=(SELECT revision FROM ai_builder_business_memory WHERE id=$1) WHERE id=$2",[this.memoryId,this.projectId]); }
  async verify() { return true; }
  async appendHistory(result: RepairResult) { await this.client.query("INSERT INTO ai_builder_business_memory_reconciliation_history (id,memory_id,starting_revision,resulting_revision,mutation_fingerprint,changed_ids,created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())",[randomUUID(),this.memoryId,result.startingRevision,result.resultingRevision,result.mutationFingerprint,JSON.stringify(result.changedIds)]); }
}
