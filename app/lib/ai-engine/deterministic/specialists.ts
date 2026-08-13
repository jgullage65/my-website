import type { DeterministicFact } from "./contracts";
import type { EvidenceLane, RoutedSourceBlock } from "./routing";
import {
  attachKnowledgeOwner,
  ownerForCategory,
  type KnowledgeOwnerId,
  type OwnedDeterministicFact,
} from "./ownership";
import { reviewBusinessIdentity } from "./owners/businessIdentity";
import { reviewCommercial } from "./owners/commercial";
import { reviewMarketCustomer } from "./owners/marketCustomer";
import { reviewOperationsContext } from "./owners/operationsContext";
import { reviewProofAuthority } from "./owners/proofAuthority";
import type { OwnerReviewer } from "./owners/types";

const REVIEWER_BY_OWNER: Record<KnowledgeOwnerId, OwnerReviewer> = {
  business_identity: reviewBusinessIdentity,
  commercial: reviewCommercial,
  market_customer: reviewMarketCustomer,
  proof_authority: reviewProofAuthority,
  operations_context: reviewOperationsContext,
};

function laneByEvidence(blocks: readonly RoutedSourceBlock[]) {
  return new Map(blocks.map((block) => [block.id, block.evidenceLane] as const));
}

function factLanes(fact: DeterministicFact, byBlock: ReadonlyMap<string, EvidenceLane>): EvidenceLane[] {
  return fact.evidence
    .map((evidence) => evidence.sourceBlockId ? byBlock.get(evidence.sourceBlockId) : undefined)
    .filter((lane): lane is EvidenceLane => Boolean(lane));
}

export function assignFactsToOwners(
  facts: readonly DeterministicFact[],
  routedBlocks: readonly RoutedSourceBlock[],
): OwnedDeterministicFact[] {
  const byBlock = laneByEvidence(routedBlocks);
  const accepted: OwnedDeterministicFact[] = [];

  for (const fact of facts) {
    const ownerId = ownerForCategory(fact.category);
    const reviewer = REVIEWER_BY_OWNER[ownerId];
    const decision = reviewer({ fact, lanes: factLanes(fact, byBlock) });
    if (!decision.accept) continue;
    accepted.push(attachKnowledgeOwner(fact));
  }

  return accepted;
}
