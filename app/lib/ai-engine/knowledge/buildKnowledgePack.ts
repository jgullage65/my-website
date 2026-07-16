/**
 * Knowledge Pack Builder
 *
 * Converts a reviewed session into immutable approved knowledge.
 */

import type {
    AiBuilderSession,
    BusinessContextEntry,
    GeneratedFaqEntry,
  } from "@/app/lib/ai-engine/contracts";
  import type {
    KnowledgeFact,
    KnowledgeFaq,
    KnowledgePack,
  } from "./contracts";
  import {
    filterApprovedContextEntries,
    filterApprovedFaqEntries,
  } from "./filterApprovedKnowledge";
  
  function normalizeText(value: unknown): string {
    return String(value ?? "")
      .replace(/\u0000/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function normalizeStringArray(
    values: unknown,
    limit = 20,
  ): string[] {
    if (!Array.isArray(values)) return [];
  
    const seen = new Set<string>();
    const result: string[] = [];
  
    values.forEach((value) => {
      const normalized = normalizeText(value);
      const key = normalized.toLowerCase();
  
      if (!normalized || seen.has(key) || result.length >= limit) {
        return;
      }
  
      seen.add(key);
      result.push(normalized);
    });
  
    return result;
  }
  
  function mapFact(entry: BusinessContextEntry): KnowledgeFact {
    return {
      id: `knowledge_${entry.id}`,
      category: entry.category,
      title: normalizeText(entry.title),
      content: normalizeText(entry.content),
      confidence: entry.confidence,
      confidenceScore: entry.confidenceScore,
      sourceEntryId: entry.id,
      sourceExcerpt: normalizeText(entry.source.excerpt),
      sourceType: entry.source.sourceType,
      tags: normalizeStringArray(entry.metadata.tags),
    };
  }
  
  function mapFaq(entry: GeneratedFaqEntry): KnowledgeFaq {
    return {
      id: `knowledge_${entry.id}`,
      question: normalizeText(entry.question),
      answer: normalizeText(entry.answer),
      confidence: entry.confidence,
      confidenceScore: entry.confidenceScore,
      sourceEntryIds: normalizeStringArray(
        entry.sourceEntryIds,
        20,
      ),
    };
  }
  
  function sortFacts(facts: KnowledgeFact[]): KnowledgeFact[] {
    return facts.slice().sort((left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }
  
      return left.title.localeCompare(right.title);
    });
  }
  
  function sortFaq(faq: KnowledgeFaq[]): KnowledgeFaq[] {
    return faq.slice().sort((left, right) =>
      left.question.localeCompare(right.question),
    );
  }
  
  export function buildKnowledgePack(
    session: AiBuilderSession,
  ): KnowledgePack {
    const approvedFacts = filterApprovedContextEntries(session)
      .map(mapFact);
  
    const approvedFaq = filterApprovedFaqEntries(session)
      .map(mapFaq);
  
    const behaviorRules = approvedFacts.filter(
      (fact) => fact.category === "behavior_rule",
    );
  
    const prohibitedClaims = approvedFacts.filter(
      (fact) => fact.category === "prohibited_claim",
    );
  
    const facts = approvedFacts.filter(
      (fact) =>
        fact.category !== "behavior_rule" &&
        fact.category !== "prohibited_claim",
    );
  
    return {
      sessionId: session.id,
      assistantName:
        normalizeText(session.assistantConfiguration.name) ||
        "Business AI Assistant",
      assistantPurpose:
        normalizeText(session.assistantConfiguration.purpose) ||
        "Answer questions using approved business knowledge.",
      assistantTone:
        normalizeText(session.assistantConfiguration.tone) ||
        "Professional and helpful",
      primaryAudience:
        normalizeText(
          session.assistantConfiguration.primaryAudience,
        ) || null,
      facts: sortFacts(facts),
      faq: sortFaq(approvedFaq),
      behaviorRules: sortFacts(behaviorRules),
      prohibitedClaims: sortFacts(prohibitedClaims),
      builtAt: new Date().toISOString(),
      version: 1,
    };
  }
  