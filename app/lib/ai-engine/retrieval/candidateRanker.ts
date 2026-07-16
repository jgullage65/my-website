import type {ScoredCandidate} from "./contracts";

export function rankCandidates(candidates:ScoredCandidate[],max=8){
 return [...candidates].sort((a,b)=>b.score-a.score).slice(0,max);
}
