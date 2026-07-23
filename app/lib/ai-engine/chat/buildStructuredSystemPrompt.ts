import type { AssistantProjection } from "../assistant-projection/contracts";
import type { StructuredCanonicalRetrievalResult, StructuredCanonicalRetrievalItem } from "./structuredCanonicalRetrieval";
import type { ResponseDepthDecision } from "./classifyResponseDepth";
function render(item: StructuredCanonicalRetrievalItem): string {
 if (item.category === "identity") { const identity = item.item; return `identity: ${"businessName" in identity ? identity.businessName ?? "Unknown business" : "Unknown business"}`; }
 if (item.category === "missing_information") { const missing = item.item; return "topic" in missing ? `Missing ${missing.topic}: ${missing.reason}. Follow-up: ${missing.suggestedFollowUpQuestion}` : ""; }
 if ("instruction" in item.item) return `restriction: ${item.item.instruction}`;
 if (!("title" in item.item)) return "";
 return `${item.category}: ${item.item.title}: ${item.item.value}${item.provenance?.correctedAt ? ` (corrected ${item.provenance.correctedAt})` : ""}`;
}
export function buildStructuredSystemPrompt(projection: AssistantProjection, retrieved: StructuredCanonicalRetrievalResult, response: ResponseDepthDecision): string {
 const direct = retrieved.items.filter(x=>x.direct).map(render), related = retrieved.items.filter(x=>!x.direct).map(render);
 const evidence = retrieved.evidence.map(x=>`Evidence: ${x.excerpt}`).join("\n") || "None retrieved.";
 const sources = retrieved.sources.map(x=>`Source: ${x.label ?? x.url ?? x.origin} (${x.origin})`).join("\n") || "None retrieved.";
 return [`You are ${projection.assistant.name}.`, projection.assistant.purpose, `Tone: ${projection.assistant.tone}`, "Only answer from approved canonical business knowledge.", "Do not invent unsupported business facts. Be transparent when required information is missing.", `Response guidance: ${response.reason}`, `Directly relevant canonical knowledge:\n${direct.join("\n") || "None retrieved."}`, `Related supporting knowledge:\n${related.join("\n") || "None retrieved."}`, `Restrictions:\n${retrieved.items.filter(x=>x.category==="restriction").map(render).join("\n") || "None retrieved."}`, `Bounded supporting evidence:\n${evidence}`, `Source provenance:\n${sources}`].join("\n\n");
}
