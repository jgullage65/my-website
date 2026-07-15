export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v4";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "email" | "phone" | "freeform" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user