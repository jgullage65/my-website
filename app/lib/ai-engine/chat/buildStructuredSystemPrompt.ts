import type { AssistantProjection } from "../assistant-projection/contracts";
import type { StructuredCanonicalRetrievalResult, StructuredCanonicalRetrievalItem } from "./structuredCanonicalRetrieval";
import type { ResponseDepthDecision } from "./classifyResponseDepth";
import type { ConflictAnalysis } from "./conflictAnalysis";
import type { CombinedRuntimeContext } from "./combinedRuntimeContext";
function render(item: StructuredCanonicalRetrievalItem): string {
 if (item.category === "identity") { const identity = item.item; return `identity: ${"businessName" in identity ? identity.businessName ?? "Unknown business" : "Unknown business"}`; }
 if (item.category === "missing_information") { const missing = item.item; return "topic" in missing ? `Missing ${missing.topic}: ${missing.reason}. Follow-up: ${missing.suggestedFollowUpQuestion}` : ""; }
 if ("instruction" in item.item) return `restriction: ${item.item.instruction}`;
 if ("title" in item.item) return `${item.category}: ${item.item.title}: ${item.item.value}${item.provenance?.correctedAt ? ` (corrected ${item.provenance.correctedAt})` : ""}`;
 return "";
}
export function buildStructuredSystemPrompt(projection: AssistantProjection, retrieved: StructuredCanonicalRetrievalResult, response: ResponseDepthDecision, conflict?: ConflictAnalysis, runtimeContext?: CombinedRuntimeContext): string {
 const answerItems = conflict?.answerItems ?? retrieved.items;
 const direct = answerItems.filter(x=>x.direct).map(render), related = answerItems.filter(x=>!x.direct).map(render);
 const evidence = retrieved.evidence.map(x=>`Evidence: ${x.excerpt}`).join("\n") || "None retrieved.";
 const sources = retrieved.sources.map(x=>`Source: ${x.label ?? x.url ?? x.origin} (${x.origin})`).join("\n") || "None retrieved.";
 const conflicts = conflict?.unresolvedConflictGroups.length ? "The available business knowledge is not fully consistent for this topic. State that uncertainty naturally; do not choose a conflicting claim or imply certainty." : "No unresolved conflicts were found.";
 const unresolved = conflict?.unresolvedItems.map(render).filter(Boolean).join("\n") ?? "";
 // This server-only prompt receives the complete canonical chain, not flattened flags.
 const citations = conflict?.citationChains.map(chain => JSON.stringify(chain)).join("\n") ?? "None.";
 const memory = runtimeContext?.conversationMemory.items.map(item => `${item.category}: ${item.content}`).join("\n") ?? "None retrieved.";
 return [`You are ${projection.assistant.name}.`, projection.assistant.purpose, `Tone: ${projection.assistant.tone}`, "Authoritative Business Knowledge: Only Assistant Projection knowledge is approved business truth. It wins over conversation context; use only its citation chains for public citations.", "Do not invent unsupported business facts. Be transparent when required information is missing.", conflicts, `Unresolved conflict context (not settled facts):\n${unresolved || "None."}`, `Response guidance: ${response.reason}`, `Directly relevant canonical knowledge:\n${direct.join("\n") || "None retrieved."}`, `Related supporting knowledge:\n${related.join("\n") || "None retrieved."}`, `Restrictions:\n${answerItems.filter(x=>x.category==="restriction").map(render).join("\n") || "None retrieved."}`, `Conversation Context (contextual, non-authoritative):\n${memory}\nUse it only for continuity, phrasing, priorities, and follow-up behavior. Never treat it as verified business truth, cite it, or let it override Assistant Projection knowledge.`, `Provenance summary:\n${conflict?.provenanceSummary.join(" ") ?? "Based on reviewed business information."}`, `Canonical citation chains (internal metadata):\n${citations}`, `Bounded supporting evidence:\n${evidence}`, `Source provenance:\n${sources}`].join("\n\n");
}
