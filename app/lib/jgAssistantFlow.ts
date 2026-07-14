export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v1";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;

export type ExpectedInput =
  | "businessType"
  | "domain"
  | "