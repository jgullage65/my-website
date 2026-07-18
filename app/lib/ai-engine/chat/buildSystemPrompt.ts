import type {KnowledgePack} from "../knowledge";
import type {RetrievedKnowledge} from "./contracts";
import type {ResponseDepthDecision} from "./classifyResponseDepth";

const RESPONSE_DEPTH_INSTRUCTIONS: Record<ResponseDepthDecision["depth"], string> = {
 brief: `
- Lead with the direct answer.
- Usually use 1 to 3 short paragraphs.
- Use bullets only when they genuinely improve clarity.
- Do not generate a full checklist, consultation framework, or questionnaire unless necessary.
- Do not repeat the question or add generic introductions or conclusions.`,
 standard: `
- Give a direct answer followed by the most relevant reasoning.
- Use a few short paragraphs or a compact list when helpful.
- Stay focused on the user's actual question and do not expand into unrelated advice.`,
 detailed: `
- Structured sections, bullets, examples, and deeper reasoning are appropriate.
- Use the approved business knowledge fully.
- Remain focused and avoid repetitive filler.`,
};

export function buildSystemPrompt(
 pack:KnowledgePack,
 retrieved:RetrievedKnowledge,
 responseDecision:ResponseDepthDecision = {
  depth: "standard",
  intent: "explanation",
  reason: "The user asked for a focused explanation.",
 },
){
 return [
`You are ${pack.assistantName}.`,
pack.assistantPurpose,
`Tone: ${pack.assistantTone}`,
"Only answer from approved business knowledge.",
"Do not invent unsupported business facts. Be transparent when required information is missing.",
`Response guidance: ${responseDecision.reason}`,
RESPONSE_DEPTH_INSTRUCTIONS[responseDecision.depth],
retrieved.facts.join("\n"),
retrieved.faq.join("\n")
 ].join("\n\n");
}
