import type {
  AiBuilderSession,
  BusinessContextCounts,
  GeneratedFaqEntry,
  IntakeConflict,
  MissingBusinessInformation,
} from "@/app/lib/ai-engine/contracts";
import type { RunEngineInput } from "./contracts";
import {
  buildIntakeProgress,
  processIntake,
} from "./processIntake";

function countProposedContext(
  entries: AiBuilderSession["contextEntries"],
): BusinessContextCounts {
  const byCategory: BusinessContextCounts["byCategory"] = {};

  entries.forEach((entry) => {
    byCategory[entry.category] =
      (byCategory[entry.category] ?? 0) + 1;
  });

  return {
    total: entries.length,
    approved: 0,
    proposed: entries.length,
    archived: 0,
    byCategory,
  };
}

function mapFaqEntries(params: {
  sessionId: string;
  createdAt: string;
  faqCandidates: Awaited<
    ReturnType<typeof processIntake>
  >["intake"]["result"]["faqCandidates"];
}): GeneratedFaqEntry[] {
  return params.faqCandidates.map((faq) => ({
    id: faq.temporaryId,
    sessionId: params.sessionId,
    question: faq.question,
    answer: faq.answer,
    confidence: faq.confidence,
    confidenceScore: faq.confidenceScore,
    sourceEntryIds: faq.sourceFactIds,
    status: "proposed",
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  }));
}

function mapConflicts(
  result: Awaited<ReturnType<typeof processIntake>>,
): IntakeConflict[] {
  return result.intake.result.conflicts.map((conflict) => ({
    id: conflict.temporaryId,
    topic: conflict.topic,
    firstStatement: conflict.firstStatement,
    secondStatement: conflict.secondStatement,
    sourceExcerpts: conflict.sourceExcerpts,
    suggestedQuestion: conflict.suggestedQuestion,
    resolved: false,
    resolution: null,
  }));
}

function mapMissingInformation(
  result: Awaited<ReturnType<typeof processIntake>>,
): MissingBusinessInformation[] {
  return result.intake.result.missingInformation.map((item) => ({
    id: item.temporaryId,
    topic: item.topic,
    reason: item.reason,
    suggestedQuestion: item.suggestedQuestion,
    resolved: false,
  }));
}

export async function runEngine(
  input: RunEngineInput,
): Promise<AiBuilderSession> {
  const result = await processIntake(
    input.request,
    input.dependencies,
  );

  const createdAt = result.proposedContext.createdAt;
  const contextEntries = result.proposedContext.entries;
  const faqEntries = mapFaqEntries({
    sessionId: input.request.sessionId,
    createdAt,
    faqCandidates: result.intake.result.faqCandidates,
  });

  return {
    id: input.request.sessionId,
    status: "review_required",
    intakeBlocks: input.request.blocks.map((block) => ({
      id: block.id,
      label: block.label,
      content: block.content,
      createdAt,
      updatedAt: createdAt,
    })),
    assistantConfiguration: {
      name: "Business AI Assistant",
      purpose:
        input.request.assistantPurpose ??
        "Answer questions using approved business knowledge.",
      tone:
        input.request.assistantTone ??
        "Professional and helpful",
      responseStyle: "Grounded and concise",
      primaryAudience:
        result.intake.result.summary.primaryAudience,
      escalationInstructions: [],
    },
    contextEntries,
    faqEntries,
    conflicts: mapConflicts(result),
    missingInformation: mapMissingInformation(result),
    contextCounts: countProposedContext(contextEntries),
    buildProgress: buildIntakeProgress(result),
    createdAt,
    updatedAt: createdAt,
    expiresAt: null,
  };
}
