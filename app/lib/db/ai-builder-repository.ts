import "server-only";

import type {
  AiBuilderSession,
  ConversationMemory,
} from "@/app/lib/ai-engine/contracts";
import { ensureAiBuilderSchema } from "./ai-builder-schema";
import { getSql } from "./client";

type PersistAiBuilderProjectInput = {
  session: AiBuilderSession;
  businessName: string;
  industry: string;
  website: string | null;
  initialThread: {
    id: string;
    memory: ConversationMemory;
  };
};

export async function persistAiBuilderProject({
  session,
  businessName,
  industry,
  website,
  initialThread,
}: PersistAiBuilderProjectInput): Promise<void> {
  await ensureAiBuilderSchema();

  const sql = getSql();

  await sql`
    INSERT INTO ai_builder_projects (
      id,
      status,
      business_name,
      industry,
      website,
      assistant_configuration,
      context_counts,
      created_at,
      updated_at,
      expires_at
    ) VALUES (
      ${session.id},
      ${session.status},
      ${businessName},
      ${industry},
      ${website},
      ${JSON.stringify(session.assistantConfiguration)}::jsonb,
      ${JSON.stringify(session.contextCounts)}::jsonb,
      ${session.createdAt}::timestamptz,
      ${session.updatedAt}::timestamptz,
      ${session.expiresAt}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      business_name = EXCLUDED.business_name,
      industry = EXCLUDED.industry,
      website = EXCLUDED.website,
      assistant_configuration = EXCLUDED.assistant_configuration,
      context_counts = EXCLUDED.context_counts,
      updated_at = EXCLUDED.updated_at,
      expires_at = EXCLUDED.expires_at
  `;

  await Promise.all(
    session.intakeBlocks.map((block) => sql`
      INSERT INTO ai_builder_intake_blocks (
        id,
        project_id,
        label,
        content,
        created_at,
        updated_at
      ) VALUES (
        ${block.id},
        ${session.id},
        ${block.label},
        ${block.content},
        ${block.createdAt}::timestamptz,
        ${block.updatedAt}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        content = EXCLUDED.content,
        updated_at = EXCLUDED.updated_at
    `),
  );

  await Promise.all(
    session.contextEntries.map((entry) => sql`
      INSERT INTO ai_builder_context_entries (
        id,
        project_id,
        category,
        title,
        content,
        confidence,
        confidence_score,
        status,
        source,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        ${entry.id},
        ${session.id},
        ${entry.category},
        ${entry.title},
        ${entry.content},
        ${entry.confidence},
        ${entry.confidenceScore},
        ${entry.status},
        ${JSON.stringify(entry.source)}::jsonb,
        ${JSON.stringify(entry.metadata)}::jsonb,
        ${entry.createdAt}::timestamptz,
        ${entry.updatedAt}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        confidence = EXCLUDED.confidence,
        confidence_score = EXCLUDED.confidence_score,
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `),
  );

  await Promise.all(
    session.faqEntries.map((entry) => sql`
      INSERT INTO ai_builder_faq_entries (
        id,
        project_id,
        question,
        answer,
        confidence,
        confidence_score,
        source_entry_ids,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${entry.id},
        ${session.id},
        ${entry.question},
        ${entry.answer},
        ${entry.confidence},
        ${entry.confidenceScore},
        ${JSON.stringify(entry.sourceEntryIds)}::jsonb,
        ${entry.status},
        ${entry.createdAt}::timestamptz,
        ${entry.updatedAt}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        question = EXCLUDED.question,
        answer = EXCLUDED.answer,
        confidence = EXCLUDED.confidence,
        confidence_score = EXCLUDED.confidence_score,
        source_entry_ids = EXCLUDED.source_entry_ids,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `),
  );

  await Promise.all(
    session.conflicts.map((conflict) => sql`
      INSERT INTO ai_builder_conflicts (
        id,
        project_id,
        topic,
        first_statement,
        second_statement,
        source_excerpts,
        suggested_question,
        resolved,
        resolution
      ) VALUES (
        ${conflict.id},
        ${session.id},
        ${conflict.topic},
        ${conflict.firstStatement},
        ${conflict.secondStatement},
        ${JSON.stringify(conflict.sourceExcerpts)}::jsonb,
        ${conflict.suggestedQuestion},
        ${conflict.resolved},
        ${conflict.resolution ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        topic = EXCLUDED.topic,
        first_statement = EXCLUDED.first_statement,
        second_statement = EXCLUDED.second_statement,
        source_excerpts = EXCLUDED.source_excerpts,
        suggested_question = EXCLUDED.suggested_question,
        resolved = EXCLUDED.resolved,
        resolution = EXCLUDED.resolution
    `),
  );

  await Promise.all(
    session.missingInformation.map((item) => sql`
      INSERT INTO ai_builder_missing_information (
        id,
        project_id,
        topic,
        reason,
        suggested_question,
        resolved
      ) VALUES (
        ${item.id},
        ${session.id},
        ${item.topic},
        ${item.reason},
        ${item.suggestedQuestion},
        ${item.resolved}
      )
      ON CONFLICT (id) DO UPDATE SET
        topic = EXCLUDED.topic,
        reason = EXCLUDED.reason,
        suggested_question = EXCLUDED.suggested_question,
        resolved = EXCLUDED.resolved
    `),
  );

  await sql`DELETE FROM ai_builder_progress WHERE project_id = ${session.id}`;

  for (const progress of session.buildProgress) {
    await sql`
      INSERT INTO ai_builder_progress (
        project_id,
        stage,
        message,
        completed,
        count,
        created_at
      ) VALUES (
        ${session.id},
        ${progress.stage},
        ${progress.message},
        ${progress.completed},
        ${progress.count ?? null},
        ${progress.createdAt}::timestamptz
      )
    `;
  }

  await sql`
    INSERT INTO ai_builder_chat_threads (
      id,
      project_id,
      title,
      memory,
      created_at,
      updated_at
    ) VALUES (
      ${initialThread.id},
      ${session.id},
      ${"Demo conversation"},
      ${JSON.stringify(initialThread.memory)}::jsonb,
      ${session.createdAt}::timestamptz,
      ${session.updatedAt}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      memory = EXCLUDED.memory,
      updated_at = EXCLUDED.updated_at
  `;
}
