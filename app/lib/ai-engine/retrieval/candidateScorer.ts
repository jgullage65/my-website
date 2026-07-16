import type {ScoredCandidate} from "./contracts";

export function scoreCandidates(message:string,candidates:ScoredCandidate[]):ScoredCandidate[]{
 const text=message.toLowerCase();
 return candidates.map(c=>{
   let score=0;
   if(text.includes(c.sourceLabel.toLowerCase())){score+=0.6;c.reasons.push("title_match");}
   if(text.includes(c.category.toLowerCase().replaceAll("_"," "))){score+=0.2;c.reasons.push("category_match");}
   score+=c.confidence==="high"?0.2:c.confidence==="medium"?0.1:0;
   return {...c,score,relevanceScore:score};
 });
}
