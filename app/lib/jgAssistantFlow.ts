export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v3";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "businessType" | "domain" | "promoWhat" | "goal" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
