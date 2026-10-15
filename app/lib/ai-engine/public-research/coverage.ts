import { calculateCoverage } from "../deterministic/coverage";
import { scoreConfidence } from "../deterministic/confidence";
import { canonicalTopicKey } from "../deterministic/topics";
import { sha256 } from "../crawler/websiteSourceRecords";
import type { DeterministicFact } from "../deterministic/contracts";
import type { ResearchFact } from "./contracts";

export function publicDeterministicFacts(facts: readonly ResearchFact[]): DeterministicFact[] {
  return facts.filter(f => f.research.state === "supported").map(fact => {
    const provenance = fact.research.sourceKind === "official_record" ? "public_record" as const : "external_source" as const;
    return {...fact, id: "public_fact_" + sha256(fact.category + "\0" + fact.value),
      topicKey: canonicalTopicKey({category:fact.category,value:fact.value,suggestedTopic:fact.title}),
      provenance, explicit:true,confidenceScore:0,
      evidence:fact.evidence.map(e=>({...e,pageType:"other" as const,
        sourceType: fact.research.sourceKind === "official_record" ? "structured_data" as const : "html" as const,
        provenance, structured:fact.research.sourceKind === "official_record"}))};
  });
}
export function publicCoverage(facts: readonly ResearchFact[]) {
  const accepted = publicDeterministicFacts(facts);
  return calculateCoverage(scoreConfidence(accepted, []), [], accepted.filter(f=>f.category==="faq").length);
}
