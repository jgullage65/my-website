export type AssistantQualityQuestionCategory =
  | "company"
  | "service"
  | "product"
  | "pricing"
  | "policy"
  | "faq"
  | "restriction"
  | "comparison"
  | "ambiguity"
  | "conflict"
  | "unknown";

export type AssistantQualityQuestionSource =
  | "system_catalog"
  | "generated"
  | "user_selected"
  | "regression";

export type AssistantQualityRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AssistantQualityQuestionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type AssistantQualityProvider = "openai" | "perplexity" | (string & {});

export type AssistantQualityModelSelection = {
  provider: AssistantQualityProvider;
  model: string;
};

export type AssistantQualityQuestionDefinition = {
  id: string;
  title: string;
  prompt: string;
  category: AssistantQualityQuestionCategory;
  source: AssistantQualityQuestionSource;
  purpose: string;
  expectedBehavior: string[];
  tags: string[];
  enabledByDefault: boolean;
};

export type AssistantQualityRunQuestion = {
  id: string;
  definitionId: string | null;
  title: string;
  prompt: string;
  category: AssistantQualityQuestionCategory;
  source: AssistantQualityQuestionSource;
  status: AssistantQualityQuestionStatus;
  sequence: number;
};

export type AssistantQualityRun = {
  id: string;
  projectId: string;
  status: AssistantQualityRunStatus;
  modelSelection: AssistantQualityModelSelection;
  questions: AssistantQualityRunQuestion[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type AssistantQualityExecutionMetadata = {
  provider: AssistantQualityProvider;
  model: string;
  feature: "assistant_quality";
  providerRequestId?: string | null;
  providerResponseId?: string | null;
};

export type AssistantQualityQuestionResult = {
  id: string;
  runId: string;
  questionId: string;
  status: AssistantQualityQuestionStatus;
  answer: string | null;
  citations: string[];
  execution: AssistantQualityExecutionMetadata | null;
  errorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type CreateAssistantQualityRunInput = {
  projectId: string;
  modelSelection: AssistantQualityModelSelection;
  questions: Array<
    Pick<
      AssistantQualityRunQuestion,
      "definitionId" | "title" | "prompt" | "category" | "source" | "sequence"
    >
  >;
};
