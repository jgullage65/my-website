import type {IntakeExtractionRequest,IntakeModelRunner,IntakeExtractionResponse} from "@/app/lib/ai-engine/intake";
import type {BusinessMemory,ConversationMemory} from "@/app/lib/ai-engine/contracts";
import type {RetrievalInput} from "@/app/lib/ai-engine/retrieval";

export type RuntimeDependencies={
 runIntakeModel:IntakeModelRunner;
};

export type RuntimeState={
 businessMemory:BusinessMemory|null;
 conversationMemory:ConversationMemory;
};

export type RuntimeResult={
 intake?:IntakeExtractionResponse;
 retrieval?:ReturnType<(input:RetrievalInput)=>any>;
};
