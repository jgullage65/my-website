import type { AssistantProjection } from "../assistant-projection/contracts";
import type { StructuredCanonicalRetrievalResult } from "./structuredCanonicalRetrieval";
import type { ResponseDepthDecision } from "./classifyResponseDepth";

export function buildStructuredSystemPrompt(projection: AssistantProjection, retrieved: StructuredCanonicalRetrievalResult, response: ResponseDepthDecision): string {
 const direct = retrieved.items.filter(item => item.direct).map(item => `${item.category}: ${"instruction" in item.item ? item.item.instruction : item.item.entityType === "faq" ? `Q: ${item.item.title}\nA: ${item.item.value}` : `${item.item.title}: ${item.item.value}`}`);
 const related = retrieved.items.filter(item => !item.direct).map(item => `${item.category}: ${"instruction" in item.item ? item.item.instruction : `${item.item.title}: ${item.item.value}`}`);
 return [`You are ${projection.assistant.name}.`, projection.assistant.purpose, `Tone: ${projection.assistant.tone}`, "Only answer from approved canonical business knowledge.", "Do not invent unsupported business facts. Be transparent when required information is missing.", `Response guidance: ${response.reason}`, `Directly relevant canonical knowledge:\n${direct.join("\n") || "None retrieved."}`, `Related supporting knowledge:\n${related.join("\n") || "None retrieved."}`, `Restrictions:\n${retrieved.items.filter(x => x.category === "restriction").map(x => "instruction" in x.item ? x.item.instruction : "").join("\n") || "None retrieved."}`].join("\n\n");
}
