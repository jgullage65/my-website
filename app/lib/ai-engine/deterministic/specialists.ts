import type { DeterministicFact } from "./contracts";
import type { EvidenceLane, RoutedSourceBlock } from "./routing";
import {
  attachKnowledgeOwner,
  ownerForCategory,
  type KnowledgeOwnerId,
  type OwnedDeterministicFact,
} from "./ownership";

const OWNER_ALLOWED_LANES: Record<KnowledgeOwnerId, readonly EvidenceLane[]> = {
  business_identity: ["core_business", "market_customer", "operations", "technical", "unknown"],
  commercial: ["core_business", "commercial", "technical", "unknown"],
  market_customer: ["core_business", "commercial", "market_customer", "unknown"],
  proof_authority: ["core_business", "commercial", "proof", "market_customer", "unknown"],
  operations_context: ["operations", "legal", "technical", "editorial", "core_business", "unknown"],
};

function laneByEvidence(blocks: readonly RoutedSourceBlock[]) {
  return new Map(blocks.map((block) => [block.id, block.evidenceLane] as const));
}

function factLanes(fact: DeterministicFact, routedBlocks: readonly RoutedSourceBlock[]): EvidenceLane[] {
  const byBlock = laneByEvidence(routedBlocks);
  return fact.evidence
    .map((evidence) => evidence.sourceBlockId ? byBlock.get(evidence.sourceBlockId) : undefined)
    .filter((lane): lane is EvidenceLane => Boolean(lane));
}

function ownerAcceptsEvidence(ownerId: KnowledgeOwnerId, lanes: readonly EvidenceLane[]) {
  if (!lanes.length) return true;
  const allowed = OWNER_ALLOWED_LANES[ownerId];
  return lanes.some((lane) => allowed.includes(lane));
}

export function assignFactsToOwners(
  facts: readonly DeterministicFact[],
  routedBlocks: readonly RoutedSourceBlock[],
): OwnedDeterministicFact[] {
  return facts
    .filter((fact) => {
      const ownerId = ownerForCategory(fact.category);
      return ownerAcceptsEvidence(ownerId, factLanes(fact, routedBlocks));
    })
    .map(attachKnowledgeOwner);
}
