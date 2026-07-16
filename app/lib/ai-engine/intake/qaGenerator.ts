/**
 * FAQ Generator
 *
 * Purpose:
 * Produces grounded FAQ candidates from extracted facts.
 *
 * This first version is deterministic. A later model-backed generator can
 * be added behind the same contract without changing downstream modules.
 */

import type {
    ExtractedBusinessFact,
    GeneratedFaq,
  } from "./contracts";
  import {
    confidenceFromScore,
    dedupeByKey,
    normalizeInlineText,
    stableIntakeId,
  } from "./normalizer";
  
  function questionForFact(fact: ExtractedBusinessFact): string | null {
    const subject = normalizeInlineText(fact.title || fact.content);
  
    switch (fact.category) {
      case "service":
        return `Do you offer ${subject}?`;
      case "pricing":
        return `How does pricing work for ${subject}?`;
      case "policy":
        return `What is your policy regarding ${subject}?`;
      case "process":
        return `How does ${subject} work?`;
      case "audience":
        return "Who is this business best suited for?";
      case "business_profile":
        return "What does this business do?";
      case "differentiator":
        return "What makes this business different?";
      default:
        return null;
    }
  }
  
  function answerForFact(fact: ExtractedBusinessFact): string {
    return fact.content;
  }
  
  export function generateFaqCandidates(
    facts: ExtractedBusinessFact[],
  ): GeneratedFaq[] {
    const generated = facts.flatMap((fact) => {
      if (fact.category === "faq") {
        return [];
      }
  
      const question = questionForFact(fact);
      if (!question) return [];
  
      return [
        {
          id: stableIntakeId(
            `${question}:${fact.temporaryId}`,
            "generated_faq",
          ),
          question,
          answer: answerForFact(fact),
          confidence: confidenceFromScore(fact.confidenceScore),
          confidenceScore: fact.confidenceScore,
          sourceFactIds: [fact.temporaryId],
          sourceBlockIds: [fact.sourceBlockId],
          sourceExcerpts: [fact.sourceExcerpt],
        } satisfies GeneratedFaq,
      ];
    });
  
    return dedupeByKey(generated, (faq) => faq.question);
  }
  