/**
 * Knowledge Diagnostics
 *
 * Measures whether a finalized knowledge pack is ready for demo chat.
 */

import type {
    BusinessContextCategory,
  } from "@/app/lib/ai-engine/contracts";
  import type {
    KnowledgeDiagnostics,
    KnowledgePack,
  } from "./contracts";
  
  export function getKnowledgeDiagnostics(
    pack: KnowledgePack,
  ): KnowledgeDiagnostics {
    const factsByCategory: Partial<
      Record<BusinessContextCategory, number>
    > = {};
  
    pack.facts
      .concat(pack.behaviorRules, pack.prohibitedClaims)
      .forEach((fact) => {
        factsByCategory[fact.category] =
          (factsByCategory[fact.category] ?? 0) + 1;
      });
  
    const scoredItems = pack.facts
      .map((fact) => fact.confidenceScore)
      .concat(
        pack.behaviorRules.map(
          (fact) => fact.confidenceScore,
        ),
        pack.prohibitedClaims.map(
          (fact) => fact.confidenceScore,
        ),
        pack.faq.map((faq) => faq.confidenceScore),
      );
  
    const averageConfidenceScore =
      scoredItems.length === 0
        ? 0
        : scoredItems.reduce(
            (total, score) => total + score,
            0,
          ) / scoredItems.length;
  
    const sourceBackedFacts = pack.facts.filter(
      (fact) =>
        fact.sourceEntryId.length > 0 &&
        fact.sourceExcerpt.length > 0,
    ).length;
  
    const sourceCoverage =
      pack.facts.length === 0
        ? 0
        : sourceBackedFacts / pack.facts.length;
  
    const readinessIssues: string[] = [];
  
    if (pack.facts.length === 0) {
      readinessIssues.push(
        "No approved business facts are available.",
      );
    }
  
    if (pack.faq.length === 0) {
      readinessIssues.push(
        "No approved Q&A entries are available.",
      );
    }
  
    if (sourceCoverage < 0.8) {
      readinessIssues.push(
        "Too many business facts are missing source evidence.",
      );
    }
  
    if (averageConfidenceScore < 0.55) {
      readinessIssues.push(
        "Average knowledge confidence is too low.",
      );
    }
  
    return {
      totalFacts: pack.facts.length,
      totalFaq: pack.faq.length,
      totalBehaviorRules: pack.behaviorRules.length,
      totalProhibitedClaims: pack.prohibitedClaims.length,
      factsByCategory,
      averageConfidenceScore,
      sourceCoverage,
      readyForChat:
        pack.facts.length > 0 &&
        readinessIssues.length === 0,
      readinessIssues,
    };
  }
  