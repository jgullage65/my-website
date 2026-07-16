import type {
    BusinessContextEntry,
    ConversationMemory,
  } from "@/app/lib/ai-engine/contracts";
  import type {
    IntakeExtractionRequest,
    IntakeExtractionResponse,
    IntakeModelRunner,
  } from "@/app/lib/ai-engine/intake";
  
  export type RuntimeDependencies = {
    runIntakeModel: IntakeModelRunner;
  };
  
  export type RuntimeState = {
    conversationMemory: ConversationMemory;
  };
  
  export type ProposedContextBuildResult = {
    entries: BusinessContextEntry[];
    createdAt: string;
  };
  
  export type IntakeRuntimeResult = {
    intake: IntakeExtractionResponse;
    proposedContext: ProposedContextBuildResult;
  };
  
  export type RunEngineInput = {
    request: IntakeExtractionRequest;
    state: RuntimeState;
    dependencies: RuntimeDependencies;
  };
  