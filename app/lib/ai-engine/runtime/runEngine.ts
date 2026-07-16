import {processIntake} from "./processIntake";
import {buildBusinessMemory} from "@/app/lib/ai-engine/memory";
import {buildContext} from "./buildContext";
import type {RuntimeDependencies,RuntimeState} from "./contracts";
import type {IntakeExtractionRequest} from "@/app/lib/ai-engine/intake";

export async function runEngine(request:IntakeExtractionRequest,state:RuntimeState,deps:RuntimeDependencies){
 const intake=await processIntake(request,deps);
 const businessMemory=buildBusinessMemory({
   sessionId:request.sessionId,
   entries:intake.result.facts.map(f=>({
     id:f.temporaryId,
     sessionId:request.sessionId,
     category:f.category,
     title:f.title,
     content:f.content,
     confidence:f.confidence,
     confidenceScore:f.confidenceScore,
     status:"approved",
     source:{intakeBlockId:f.sourceBlockId,excerpt:f.sourceExcerpt,sourceType:"manual_intake"},
     metadata:{generated:false,userEdited:false,conflictingEntryIds:[],tags:f.tags},
     createdAt:new Date().toISOString(),
     updatedAt:new Date().toISOString()
   })),
 });
 const retrieval=buildContext({
   message:"",
   businessMemory,
   conversationMemory:state.conversationMemory
 });
 return {intake,retrieval,businessMemory};
}
