import type {KnowledgePack} from "../knowledge";
import type {RetrievedKnowledge} from "./contracts";

export function buildSystemPrompt(pack:KnowledgePack, retrieved:RetrievedKnowledge){
 return [
`You are ${pack.assistantName}.`,
pack.assistantPurpose,
`Tone: ${pack.assistantTone}`,
"Only answer from approved business knowledge.",
retrieved.facts.join("\n"),
retrieved.faq.join("\n")
 ].join("\n\n");
}
