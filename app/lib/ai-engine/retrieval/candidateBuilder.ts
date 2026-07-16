import type {RetrievalInput,ScoredCandidate} from "./contracts";

export function buildCandidates(input:RetrievalInput):ScoredCandidate[]{
 return input.businessMemory.entries.map(e=>({
   id:e.id,
   source:"business_context",
   category:e.category,
   content:e.content,
   relevanceScore:0,
   confidence:e.confidence,
   sourceLabel:e.title,
   sourceEntryId:e.id,
   score:0,
   reasons:[]
 }));
}
