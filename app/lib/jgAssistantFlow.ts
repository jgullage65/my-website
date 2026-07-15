export const JG_ASSISTANT_STORAGE_KEY="jg-assistant-session-v5";
export type AssistantIntent="buy"|"learn"|null;
export type AssistantService="website"|"design"|"ai"|"not_sure"|null;
export type FollowUpMethod="email"|"phone"|null;
export type ExpectedInput="custom_business"|"custom_goal"|"email"|"phone"|null;
export type AssistantMessage={id:string;role:"assistant"|"user";text:string};
export type AssistantAnswers={service:AssistantService;