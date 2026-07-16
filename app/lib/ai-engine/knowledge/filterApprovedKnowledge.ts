/**
 * Approved Knowledge Filter
 *
 * Keeps proposed and archived entries out of live assistant knowledge.
 */

import type {
    AiBuilderSession,
    BusinessContextEntry,
    GeneratedFaqEntry,
  } from "@/app/lib/ai-engine/contracts";
  
  export function isApprovedKnowledgeStatus(
    status: BusinessContextEntry["status"],
  ): boolean {
    return status === "approved" || status === "corrected";
  }
  
  export function filterApprovedContextEntries(
    session: AiBuilderSession,
  ): BusinessContextEntry[] {
    return session.contextEntries.filter((entry) =>
      isApprovedKnowledgeStatus(entry.status),
    );
  }
  
  export function filterApprovedFaqEntries(
    session: AiBuilderSession,
  ): GeneratedFaqEntry[] {
    return session.faqEntries.filter((entry) =>
      isApprovedKnowledgeStatus(entry.status),
    );
  }
  