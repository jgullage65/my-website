import {buildSystemPrompt} from "./buildSystemPrompt";
import {retrieveKnowledge} from "./retrieveKnowledge";
import type {ChatRequest,ChatResponse} from "./contracts";

export async function answerQuestion(req:ChatRequest):Promise<ChatResponse>{
 const start=Date.now();
 const retrieved=retrieveKnowledge(req);
 const _prompt=buildSystemPrompt(req.knowledge,retrieved);
 return{
   answer:"Model call will be wired in the next step.",
   citations:retrieved.facts,
   diagnostics:{
     retrievedFacts:retrieved.facts.length,
     retrievedFaq:retrieved.faq.length,
     retrievalMs:Date.now()-start
   }
 };
}
