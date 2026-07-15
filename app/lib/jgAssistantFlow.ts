export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v8";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "custom_business" | "custom_project_need" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  businessType: string;
  projectNeed: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep =
  | "opening"
  | "learn_menu"
 