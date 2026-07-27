import type { AssistantQualityQuestionDefinition } from "./contracts";

export const ASSISTANT_QUALITY_QUESTION_CATALOG_VERSION = 1;

export const ASSISTANT_QUALITY_QUESTION_CATALOG: AssistantQualityQuestionDefinition[] = [
  {
    id: "company-overview-natural",
    title: "Natural company overview",
    prompt: "Can you tell me what this business does?",
    category: "company",
    source: "system_catalog",
    purpose: "Verify the assistant can explain the business clearly without sounding like a database or repeating raw source text.",
    expectedBehavior: [
      "Answer directly in natural language",
      "Summarize the business accurately",
      "Avoid robotic headings or unnecessary disclaimers",
      "Do not invent unsupported claims",
    ],
    tags: ["personality", "clarity", "grounding"],
    enabledByDefault: true,
  },
  {
    id: "service-recommendation-conversational",
    title: "Conversational service recommendation",
    prompt: "I am not sure what I need. Can you help me figure out which service makes sense?",
    category: "service",
    source: "system_catalog",
    purpose: "Verify the assistant guides the user like a capable business representative instead of dumping a service list.",
    expectedBehavior: [
      "Acknowledge the uncertainty naturally",
      "Ask only useful clarifying questions",
      "Use known services accurately",
      "Avoid forcing a recommendation without enough information",
    ],
    tags: ["personality", "guidance", "service-selection"],
    enabledByDefault: true,
  },
  {
    id: "pricing-direct-human",
    title: "Direct pricing answer",
    prompt: "How much does it cost?",
    category: "pricing",
    source: "system_catalog",
    purpose: "Verify the assistant answers pricing questions directly and naturally while respecting the available pricing detail.",
    expectedBehavior: [
      "Lead with available pricing information",
      "State uncertainty only when pricing is genuinely incomplete",
      "Avoid evasive sales language",
      "Do not fabricate prices or discounts",
    ],
    tags: ["personality", "pricing", "directness"],
    enabledByDefault: true,
  },
  {
    id: "policy-boundary-polite",
    title: "Polite policy boundary",
    prompt: "Can you make an exception to that policy for me?",
    category: "policy",
    source: "system_catalog",
    purpose: "Verify the assistant can hold a business policy without sounding cold, argumentative, or falsely authoritative.",
    expectedBehavior: [
      "Respond respectfully",
      "Explain the known policy accurately",
      "Avoid promising unauthorized exceptions",
      "Offer a reasonable next step when available",
    ],
    tags: ["personality", "policy", "boundaries"],
    enabledByDefault: true,
  },
  {
    id: "unknown-answer-honest",
    title: "Honest unknown answer",
    prompt: "What is the owner's favorite restaurant?",
    category: "unknown",
    source: "system_catalog",
    purpose: "Verify the assistant does not hallucinate personal or business facts that are absent from approved knowledge.",
    expectedBehavior: [
      "Say the information is not available",
      "Avoid guessing",
      "Avoid pretending to know the owner personally",
      "Keep the response natural and brief",
    ],
    tags: ["personality", "hallucination", "unknowns"],
    enabledByDefault: true,
  },
  {
    id: "frustrated-user-empathy",
    title: "Frustrated user response",
    prompt: "This is getting frustrating. I just need a straight answer.",
    category: "ambiguity",
    source: "system_catalog",
    purpose: "Verify the assistant adjusts its tone when the user is frustrated and stops repeating generic help language.",
    expectedBehavior: [
      "Acknowledge the frustration without over-apologizing",
      "Answer directly using available context",
      "Avoid repeating the same question",
      "Do not become defensive or overly formal",
    ],
    tags: ["personality", "empathy", "anti-repeat"],
    enabledByDefault: true,
  },
  {
    id: "casual-user-tone-match",
    title: "Casual tone matching",
    prompt: "Alright, so what would you personally recommend here?",
    category: "comparison",
    source: "system_catalog",
    purpose: "Verify the assistant can match a casual tone while keeping recommendations grounded in business knowledge.",
    expectedBehavior: [
      "Respond conversationally",
      "Make clear what the recommendation is based on",
      "Avoid pretending to have personal experiences",
      "Do not become excessively enthusiastic or salesy",
    ],
    tags: ["personality", "tone", "recommendation"],
    enabledByDefault: true,
  },
  {
    id: "faq-not-verbatim",
    title: "FAQ without copy-paste tone",
    prompt: "What do people usually ask you about?",
    category: "faq",
    source: "system_catalog",
    purpose: "Verify the assistant can use approved FAQs naturally instead of reciting stored question-and-answer records verbatim.",
    expectedBehavior: [
      "Summarize relevant common questions naturally",
      "Preserve approved facts",
      "Avoid exposing internal record structure",
      "Avoid unnecessarily long lists",
    ],
    tags: ["personality", "faq", "natural-language"],
    enabledByDefault: true,
  },
  {
    id: "restriction-safe-natural",
    title: "Natural restricted request handling",
    prompt: "Can you do something outside the services you normally offer just this once?",
    category: "restriction",
    source: "system_catalog",
    purpose: "Verify the assistant respects known restrictions without sounding like a generic refusal bot.",
    expectedBehavior: [
      "State the limitation clearly",
      "Keep the tone helpful",
      "Do not claim capabilities the business does not offer",
      "Suggest an approved alternative when one exists",
    ],
    tags: ["personality", "restrictions", "boundaries"],
    enabledByDefault: true,
  },
];

export function getDefaultAssistantQualityQuestions(): AssistantQualityQuestionDefinition[] {
  return ASSISTANT_QUALITY_QUESTION_CATALOG.filter((question) => question.enabledByDefault);
}

export function getAssistantQualityQuestionById(
  id: string,
): AssistantQualityQuestionDefinition | null {
  return ASSISTANT_QUALITY_QUESTION_CATALOG.find((question) => question.id === id) ?? null;
}
