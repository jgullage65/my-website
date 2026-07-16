import type {RetrievalInput} from "./contracts";
import {buildCandidates} from "./candidateBuilder";
import {scoreCandidates} from "./candidateScorer";
import {rankCandidates} from "./candidateRanker";
import type {RetrievalPack} from "@/app/lib/ai-engine/contracts";

export function buildRetrievalPack(input:RetrievalInput):RetrievalPack{
 const built=buildCandidates(input);
 const scored=scoreCandidates(input.message,built);
 const selected=rankCandidates(scored,input.maxCandidates??8);
 return{
  query:{sessionId:input.businessMemory.sessionId,threadId:input.conversationMemory.threadId,message:input.message,detectedTopics:[],detectedIntent:null},
  candidates:selected,
  threadMemory:{
   threadId:input.conversationMemory.threadId,
   sessionId:input.businessMemory.sessionId,
   status:"active",
   primaryGoal:input.conversationMemory.customerGoal,
   currentSubject:input.conversationMemory.currentSubject,
   selectedService:input.conversationMemory.selectedService,
   activeConstraints:[],
   collectedDetails:input.conversationMemory.collectedDetails.map(f=>f.value),
   unresolvedQuestions:input.conversationMemory.unresolvedQuestions,
   recentClarifications:input.conversationMemory.recentClarifications,
   summary:input.conversationMemory.summary,
   stickyState:{},
   lastUpdatedAt:input.conversationMemory.updatedAt
  },
  selectedContextIds:selected.map(s=>s.id),
  missingTopics:[],
  diagnostics:{
   totalCandidates:built.length,
   selectedCandidates:selected.length,
   exactFaqMatch:false,
   highestScore:selected[0]?.score??null
  }
 };
}
