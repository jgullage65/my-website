import type {BusinessMemory,ConversationMemory,RetrievalPack,ContextCandidate} from "@/app/lib/ai-engine/contracts";

export type RetrievalInput={
 message:string;
 businessMemory:BusinessMemory;
 conversationMemory:ConversationMemory;
 maxCandidates?:number;
};

export type ScoredCandidate=ContextCandidate & {score:number;reasons:string[]};
