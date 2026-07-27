import type { AssistantQualityEvaluationContext } from "./evidenceContracts";
import {
  ASSISTANT_QUALITY_EVALUATION_DIMENSIONS,
  type AssistantQualityEvaluationDimension,
} from "./evaluationContracts";

const DIMENSION_GUIDANCE: Record<AssistantQualityEvaluationDimension, string> = {
  knowledge_accuracy:
    "Judge whether factual claims match the approved canonical evidence. Do not reward unsupported claims even when they sound plausible.",
  grounding:
    "Judge whether the answer stays within approved business knowledge and clearly handles missing information without guessing.",
  conversation_quality:
    "Judge whether the response sounds natural, clear, direct, and helpful rather than robotic, repetitive, or copied from internal records.",
  reasoning:
    "Judge whether the assistant interprets the user's need correctly, asks useful clarifying questions when required, and gives a sensible next step.",
  hallucination_resistance:
    "Judge whether the assistant avoids inventing facts, prices, policies, capabilities, personal knowledge, or unsupported certainty.",
  tone_consistency:
    "Judge whether the response uses an appropriate business-representative tone and adapts naturally to the user's wording or emotional state.",
  business_readiness:
    "Judge whether this response is safe and useful enough to send to a real prospective or existing customer without human correction.",
};

function serializeEvidence(context: AssistantQualityEvaluationContext): string {
  if (!context.canonicalEvidence.length) {
    return "No canonical evidence was supplied. Do not assign factual accuracy or grounding scores that require unavailable evidence.";
  }

  return context.canonicalEvidence
    .map(
      (item, index) =>
        `${index + 1}. [${item.category}] ${item.label}\n${item.content}${
          item.sourceUrl ? `\nSource: ${item.sourceUrl}` : ""
        }`,
    )
    .join("\n\n");
}

export function buildAssistantQualityEvaluationPrompt(
  context: AssistantQualityEvaluationContext,
): string {
  const expectedBehavior = context.definition?.expectedBehavior.length
    ? context.definition.expectedBehavior.map((item) => `- ${item}`).join("\n")
    : "- No catalog expectations were supplied. Judge only against the question and evidence.";

  const dimensionInstructions = ASSISTANT_QUALITY_EVALUATION_DIMENSIONS.map(
    (dimension) => `- ${dimension}: ${DIMENSION_GUIDANCE[dimension]}`,
  ).join("\n");

  return `You are evaluating a business AI assistant response for production readiness.

Return JSON only. Do not use markdown. Do not include commentary outside the JSON object.

QUESTION
${context.question.prompt}

QUESTION PURPOSE
${context.definition?.purpose ?? "No catalog purpose supplied."}

EXPECTED BEHAVIOR
${expectedBehavior}

ASSISTANT ANSWER
${context.result.answer ?? "No answer was produced."}

ASSISTANT CITATIONS
${context.result.citations.length ? context.result.citations.join("\n") : "No citations were returned."}

CANONICAL BUSINESS EVIDENCE
${serializeEvidence(context)}

SCORING DIMENSIONS
${dimensionInstructions}

RULES
- Score each dimension from 0 to 100 only when enough evidence exists.
- Use null when a dimension cannot be responsibly judged.
- Every numeric score must include a concise rationale and at least one evidence item.
- Evidence must quote or precisely paraphrase the supplied question, answer, expectation, citation, or canonical evidence.
- Do not infer missing business facts.
- Do not reward verbosity.
- Penalize robotic phrasing, unnecessary disclaimers, evasiveness, repetition, unsupported certainty, or fake personal experience.
- Mark passed true only when the answer is safe for a real customer and has no serious factual, grounding, policy, or hallucination issue.

REQUIRED JSON SHAPE
{
  "overallScore": number | null,
  "passed": boolean | null,
  "summary": string,
  "strengths": string[],
  "issues": string[],
  "dimensions": [
    {
      "dimension": "knowledge_accuracy" | "grounding" | "conversation_quality" | "reasoning" | "hallucination_resistance" | "tone_consistency" | "business_readiness",
      "score": number | null,
      "rating": "excellent" | "good" | "needs_improvement" | "poor" | "not_scored",
      "rationale": string,
      "evidence": string[]
    }
  ]
}`;
}
