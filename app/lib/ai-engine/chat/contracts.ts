import type { KnowledgePack } from "../knowledge";

export type ChatRequest={
  knowledge:KnowledgePack;
  message:string;
};

export type RetrievedKnowledge={
  facts:string[];
  faq:string[];
};

export type ChatResponse={
  answer:string;
  citations:string[];
  diagnostics:ChatDiagnostics;
};

export type ChatDiagnostics={
  retrievedFacts:number;
  retrievedFaq:number;
  retrievalMs:number;
  runtimeSource?: "server_legacy_projection" | "trusted_knowledge_projection" | "assistant_projection";
};
