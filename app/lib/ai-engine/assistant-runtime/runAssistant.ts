import { Pool } from "@neondatabase/serverless";
import {
  analyzeCanonicalConflicts,
  buildCombinedRuntimeContext,
  buildStructuredSystemPrompt,
  classifyResponseDepth,
  retrieveStructuredCanonicalKnowledge,
  type ChatResponse,
} from "@/app/lib/ai-engine/chat";
import type { ConversationMemory } from "@/app/lib/ai-engine/memory/contracts";
import { runOpenAiChat } from "@/app/lib/ai-engine/providers/openaiChatRunner";
import { getPersistedAssistantProjectionForUpdate } from "@/app/lib/ai-engine/assistant-projection/persistence";
import {
  ASSISTANT_PROJECTION_SCHEMA_VERSION,
  ASSISTANT_PROJECTION_VERSION,
  type AssistantProjection,
} from "@/app/lib/ai-engine/assistant-projection/contracts";
import { getProjectRuntimeAuthority } from "@/app/lib/ai-engine/runtime-authority/projectRuntimeAuthority";
import { cutoverEligibilityFailure } from "@/app/lib/ai-engine/assistant-projection/cutover";
import { writeRuntimeAuthorityMismatchAfterRollback } from "@/app/lib/ai-engine/operations/operational-events";

type ParityEvidenceRow = {
  status: unknown;
  assistant_projection_version: unknown;
  assistant_projection_schema_version: unknown;
  active_runtime_authority: unknown;
  compared_at: unknown;
  artifact_fingerprint: unknown;
};

export type AssistantRuntimeFeature =
  | "ai_builder_chat"
  | "assistant_quality"
  | (string & {});

export type RunAssistantInput = {
  projectId: string;
  message: string;
  conversationMemory?: ConversationMemory | null;
  feature: AssistantRuntimeFeature;
};

export type RunAssistantResult = {
  response: ChatResponse;
  feature: AssistantRuntimeFeature;
};

let projectionPool: Pool | null = null;

function getProjectionPool(): Pool {
  projectionPool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return projectionPool;
}

function hasAnswerableAssistantProjection(projection: AssistantProjection): boolean {
  return (
    projection.services.length +
      projection.products.length +
      projection.pricing.length +
      projection.policies.length +
      projection.faqs.length +
      projection.restrictions.length >
    0
  );
}

async function loadCanonicalRuntimeKnowledge(projectId: string): Promise<AssistantProjection> {
  const client = await getProjectionPool().connect();
  let artifactFingerprint: string | null = null;
  const rejectRuntime = (code: string): never => {
    throw new Error(code);
  };

  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM ai_builder_projects WHERE id=$1 FOR UPDATE", [projectId]);

    const authority = await getProjectRuntimeAuthority(client, projectId);
    if (authority !== "canonical") {
      rejectRuntime("assistant_projection_migration_required");
    }

    const persisted = await getPersistedAssistantProjectionForUpdate(client, projectId);
    if (!persisted) {
      throw new Error("assistant_projection_runtime_unavailable_missing");
    }

    artifactFingerprint = persisted.businessMemoryFingerprint;

    if (persisted.invalidationState !== "valid") {
      rejectRuntime(`assistant_projection_runtime_unavailable_${persisted.invalidationState}`);
    }
    if (persisted.projectionVersion !== ASSISTANT_PROJECTION_VERSION) {
      rejectRuntime("assistant_projection_runtime_unavailable_unsupported_projection_version");
    }
    if (persisted.schemaVersion !== ASSISTANT_PROJECTION_SCHEMA_VERSION) {
      rejectRuntime("assistant_projection_runtime_unavailable_unsupported_schema_version");
    }

    const report = (
      await client.query(
        "SELECT status,assistant_projection_version,assistant_projection_schema_version,active_runtime_authority,compared_at,artifact_fingerprint FROM ai_builder_assistant_projection_parity_reports WHERE project_id=$1 FOR UPDATE",
        [projectId],
      )
    ).rows[0] as ParityEvidenceRow | undefined;

    const eligibilityFailure = cutoverEligibilityFailure({
      runtimeAuthority: authority,
      artifact: persisted,
      evidence: report
        ? {
            status: report.status,
            projectionVersion: report.assistant_projection_version,
            schemaVersion: report.assistant_projection_schema_version,
            activeRuntimeAuthority: report.active_runtime_authority,
            comparedAt: report.compared_at,
            artifactFingerprint: report.artifact_fingerprint,
          }
        : null,
    });

    if (eligibilityFailure) {
      rejectRuntime(eligibilityFailure);
    }

    await client.query("COMMIT");
    return persisted.projection;
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (
      cause instanceof Error &&
      (cause.message === "assistant_projection_migration_required" ||
        cause.message.startsWith("assistant_projection_runtime_unavailable"))
    ) {
      await writeRuntimeAuthorityMismatchAfterRollback(
        projectId,
        cause.message,
        artifactFingerprint,
      );
      throw cause;
    }

    const publicError = new Error(
      "assistant_projection_runtime_unavailable_validation_failure",
    );
    await writeRuntimeAuthorityMismatchAfterRollback(
      projectId,
      publicError.message,
      artifactFingerprint,
    );
    throw publicError;
  } finally {
    client.release();
  }
}

export async function runAssistant({
  projectId,
  message,
  conversationMemory = null,
  feature,
}: RunAssistantInput): Promise<RunAssistantResult> {
  const normalizedProjectId = projectId.trim();
  const normalizedMessage = message.trim().slice(0, 4000);

  if (!normalizedProjectId || !normalizedMessage) {
    throw new Error("invalid_assistant_runtime_request");
  }

  const canonicalProjection = await loadCanonicalRuntimeKnowledge(normalizedProjectId);
  if (!hasAnswerableAssistantProjection(canonicalProjection)) {
    throw new Error("assistant_projection_runtime_unavailable_empty");
  }

  const startedAt = Date.now();
  const retrieved = retrieveStructuredCanonicalKnowledge(
    canonicalProjection,
    normalizedMessage,
  );
  const runtimeContext = buildCombinedRuntimeContext(
    retrieved,
    conversationMemory,
    normalizedMessage,
  );
  const conflict = analyzeCanonicalConflicts(
    canonicalProjection,
    retrieved,
    normalizedMessage,
  );
  const responseDepthDecision = classifyResponseDepth(normalizedMessage);
  const systemPrompt = buildStructuredSystemPrompt(
    canonicalProjection,
    retrieved,
    responseDepthDecision,
    conflict,
    runtimeContext,
  );

  const answer = await runOpenAiChat({
    systemPrompt,
    message: normalizedMessage,
  });

  return {
    feature,
    response: {
      answer: conflict.unresolvedConflictGroups.length
        ? `I found conflicting approved information regarding this topic. ${answer}`
        : answer,
      citations: conflict.citationChains.map(
        (chain) =>
          chain.sources[0]?.label ??
          chain.sources[0]?.url ??
          ("instruction" in chain.projectionItem.item
            ? chain.projectionItem.item.instruction
            : "title" in chain.projectionItem.item
              ? `${chain.projectionItem.item.title}: ${chain.projectionItem.item.value}`
              : "business information"),
      ),
      diagnostics: {
        retrievedFacts: retrieved.items.filter((item) => item.category !== "faq").length,
        retrievedFaq: retrieved.items.filter((item) => item.category === "faq").length,
        retrievalMs: Date.now() - startedAt,
        runtimeSource: "assistant_projection",
        conflictAnalysis: conflict.diagnostics,
        conversationMemory: {
          available: runtimeContext.conversationMemory.available,
          selectedItemCount: runtimeContext.conversationMemory.items.length,
          selectedCategories: runtimeContext.conversationMemory.selectedCategories,
          excludedConflict: runtimeContext.conversationMemory.excludedConflict,
          retrievalDurationMs:
            runtimeContext.conversationMemory.retrievalDurationMs,
        },
        structuredRetrieval: {
          engineVersion: retrieved.engineVersion,
          intent: retrieved.query.intent,
          directCandidateCount: retrieved.diagnostics.directCandidateCount,
          relationshipExpansionCount:
            retrieved.diagnostics.relationshipExpansionCount,
          relationshipCandidateCount:
            retrieved.diagnostics.relationshipCandidateCount,
          totalCandidateCount: retrieved.diagnostics.totalCandidateCount,
          evidenceSelectedCount: retrieved.diagnostics.evidenceSelectedCount,
          sourceSelectedCount: retrieved.diagnostics.sourceSelectedCount,
          selectedDirectCount: retrieved.diagnostics.selectedDirectCount,
          selectedRelatedCount: retrieved.diagnostics.selectedRelatedCount,
          retrievalDurationMs: retrieved.diagnostics.retrievalDurationMs,
          selectedResultCount: retrieved.items.length,
          selectedCategoryCounts: retrieved.diagnostics.selectedCategoryCounts,
          topScoreBands: retrieved.diagnostics.topScoreBands,
        },
      },
    },
  };
}
