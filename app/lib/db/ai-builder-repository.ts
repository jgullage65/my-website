import "server-only";

import type {
  AiBuilderSession,
  ConversationMemory,
} from "@/app/lib/ai-engine/contracts";
import {
  WEBSITE_KNOWLEDGE_CATEGORIES,
  WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS,
  WEBSITE_KNOWLEDGE_COVERAGE_FIELDS,
  type PersistedWebsiteKnowledge,
  type StructuredWebsiteKnowledge,
} from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import { ensureAiBuilderSchema } from "./ai-builder-schema";
import { getSql } from "./client";
import type { NeonQueryFunctionInTransaction, NeonQueryInTransaction } from "@neondatabase/serverless";
import { writeCanonicalProvenanceShadow } from "./canonical-provenance-shadow";
import { requireClerkIdentity, requireClerkUserId } from "@/app/lib/auth/clerk";

type DatabaseRow = Record<string, unknown>;

export type PersistAiBuilderProjectInput = {
  session: AiBuilderSession;
  businessName: string;
  industry: string;
  website: string | null;
  websiteKnowledge: PersistedWebsiteKnowledge | null;
  initialThread: {
    id: string;
    memory: ConversationMemory;
  };
};

export type LoadedAiBuilderProject = {
  session: AiBuilderSession;
  businessName: string;
  industry: string;
  website: string | null;
  websiteKnowledge: PersistedWebsiteKnowledge | null;
  initialThread: {
    id: string;
    memory: ConversationMemory;
  } | null;
};

const websiteKnowledgeCategories = new Set<string>(WEBSITE_KNOWLEDGE_CATEGORIES);
const websiteKnowledgeConfidenceLevels = new Set<string>(WEBSITE_KNOWLEDGE_CONFIDENCE_LEVELS);

function normalizeText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximumLength);
}

function normalizeWebsiteUrl(value: unknown): string | null {
  const candidate = normalizeText(value, 2_048);
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeWebsiteKnowledge(value: unknown): PersistedWebsiteKnowledge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const document = value as Record<string, unknown>;
  if (document.schema_version !== 1) return null;
  const documentVersion = document.document_version;
  if (typeof documentVersion !== "number" || !Number.isSafeInteger(documentVersion) || documentVersion < 1) return null;

  const rawKnowledge = document.knowledge;
  if (!rawKnowledge || typeof rawKnowledge !== "object" || Array.isArray(rawKnowledge)) return null;
  const knowledgeRecord = rawKnowledge as Record<string, unknown>;
  let hasKnowledge = false;
  const facts = (Array.isArray(knowledgeRecord.facts) ? knowledgeRecord.facts : []).slice(0, 100).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const fact = entry as Record<string, unknown>;
    const category = normalizeText(fact.category, 64);
    const title = normalizeText(fact.title, 300);
    const factValue = normalizeText(fact.value, 4_000);
    const confidence = normalizeText(fact.confidence, 32);
    const evidence = (Array.isArray(fact.evidence) ? fact.evidence : []).slice(0, 8).flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const url = normalizeWebsiteUrl(record.url);
      const excerpt = normalizeText(record.excerpt, 1_000);
      return url && excerpt ? [{ url, excerpt }] : [];
    });
    if (!websiteKnowledgeCategories.has(category) || !title || !factValue || !websiteKnowledgeConfidenceLevels.has(confidence) || !evidence.length) return [];
    hasKnowledge = true;
    return [{ category, title, value: factValue, confidence, evidence }];
  }) as StructuredWebsiteKnowledge["facts"];

  const rawCoverage = knowledgeRecord.coverage && typeof knowledgeRecord.coverage === "object" && !Array.isArray(knowledgeRecord.coverage)
    ? knowledgeRecord.coverage as Record<string, unknown>
    : {};
  const coverage = Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map((field) => {
    const value = rawCoverage[field];
    const numericValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numericValue)) hasKnowledge = true;
    return [field, Number.isFinite(numericValue) ? Math.max(0, Math.min(100, numericValue)) : 0];
  })) as StructuredWebsiteKnowledge["coverage"];
  const unresolvedQuestions = (Array.isArray(knowledgeRecord.unresolvedQuestions) ? knowledgeRecord.unresolvedQuestions : [])
    .slice(0, 100)
    .map((question) => normalizeText(question, 500))
    .filter(Boolean);
  if (unresolvedQuestions.length) hasKnowledge = true;
  if (!hasKnowledge) return null;

  const pages = (Array.isArray(document.pages) ? document.pages : []).slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const page = entry as Record<string, unknown>;
    const url = normalizeWebsiteUrl(page.url);
    return url ? [{ url, title: normalizeText(page.title, 500), pageType: normalizeText(page.pageType, 100) }] : [];
  });
  const warnings = (Array.isArray(document.warnings) ? document.warnings : [])
    .slice(0, 100)
    .map((warning) => normalizeText(warning, 500))
    .filter(Boolean);

  return {
    schema_version: 1,
    document_version: documentVersion,
    current_crawl_attempt_id: normalizeText(document.current_crawl_attempt_id, 200) || null,
    imported_at: normalizeText(document.imported_at, 100) || null,
    requested_url: normalizeWebsiteUrl(document.requested_url),
    resolved_url: normalizeWebsiteUrl(document.resolved_url),
    pages,
    warnings,
    knowledge: { facts, coverage, unresolvedQuestions },
  };
}

export type AiBuilderProjectSummary = {
  id: string;
  businessName: string;
  industry: string;
  website: string | null;
  status: AiBuilderSession["status"];
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type TransactionSql = NeonQueryFunctionInTransaction<boolean, boolean>;
type AiBuilderIdentity = Awaited<ReturnType<typeof requireClerkIdentity>>;
type LegacyPersistenceSql = Pick<ReturnType<typeof getSql>, "transaction">;

type PersistAiBuilderProjectDependencies = {
  identity: AiBuilderIdentity;
  ensureSchema: () => Promise<void>;
  sql: LegacyPersistenceSql;
  writeCanonicalProvenanceShadow: typeof writeCanonicalProvenanceShadow;
};

/**
 * Neon binds parameters for SQL statements, but not inside a PostgreSQL DO
 * block's dollar-quoted body. This parameterized guard therefore uses a
 * deliberately invalid cast only for the collision branch. pg_backend_pid()
 * prevents PostgreSQL from pre-evaluating that branch; the error always carries
 * the stable ownership-collision identifier.
 */
function ownershipCollisionGuardQuery(sql: TransactionSql, projectId: string, clerkUserId: string): NeonQueryInTransaction {
  return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_projects WHERE id = ${projectId} AND clerk_user_id = ${clerkUserId}) THEN 1 ELSE CAST('AI_BUILDER_PROJECT_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS ownership_verified`;
}

/**
 * A protected child upsert can intentionally affect zero rows when its id is
 * owned by a different project. Verify its final ownership in the same ordered
 * transaction so that a no-op can never let the rest of the graph commit.
 */
function childOwnershipCollisionGuardQuery(
  sql: TransactionSql,
  table: "ai_builder_intake_blocks" | "ai_builder_context_entries" | "ai_builder_faq_entries" | "ai_builder_conflicts" | "ai_builder_missing_information" | "ai_builder_chat_threads",
  id: string,
  projectId: string,
): NeonQueryInTransaction {
  switch (table) {
    case "ai_builder_intake_blocks": return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_intake_blocks WHERE id = ${id} AND project_id = ${projectId}) THEN 1 ELSE CAST('AI_BUILDER_CHILD_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS child_ownership_verified`;
    case "ai_builder_context_entries": return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_context_entries WHERE id = ${id} AND project_id = ${projectId}) THEN 1 ELSE CAST('AI_BUILDER_CHILD_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS child_ownership_verified`;
    case "ai_builder_faq_entries": return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_faq_entries WHERE id = ${id} AND project_id = ${projectId}) THEN 1 ELSE CAST('AI_BUILDER_CHILD_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS child_ownership_verified`;
    case "ai_builder_conflicts": return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_conflicts WHERE id = ${id} AND project_id = ${projectId}) THEN 1 ELSE CAST('AI_BUILDER_CHILD_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS child_ownership_verified`;
    case "ai_builder_missing_information": return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_missing_information WHERE id = ${id} AND project_id = ${projectId}) THEN 1 ELSE CAST('AI_BUILDER_CHILD_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS child_ownership_verified`;
    case "ai_builder_chat_threads": return sql`SELECT CASE WHEN EXISTS (SELECT 1 FROM ai_builder_chat_threads WHERE id = ${id} AND project_id = ${projectId}) THEN 1 ELSE CAST('AI_BUILDER_CHILD_OWNERSHIP_COLLISION:' || pg_backend_pid() AS INTEGER) END AS child_ownership_verified`;
  }
}

/**
 * Builds the ordered HTTP transaction batch used for authoritative legacy
 * persistence. Neon executes this batch as one non-interactive transaction.
 */
export function buildLegacyProjectPersistenceQueries(
  sql: TransactionSql,
  { session, businessName, industry, website, websiteKnowledge, initialThread, identity }: PersistAiBuilderProjectInput & { identity: AiBuilderIdentity },
): NeonQueryInTransaction[] {
  const clerkUserId = identity.userId;
  const queries: NeonQueryInTransaction[] = [];
  queries.push(sql`
    INSERT INTO ai_builder_projects (
      id, status, business_name, industry, website, assistant_configuration,
      context_counts, internal_fields, created_at, updated_at, expires_at,
      clerk_user_id, owner_name, owner_email
    ) VALUES (
      ${session.id}, ${session.status}, ${businessName}, ${industry}, ${website},
      ${JSON.stringify(session.assistantConfiguration)}::jsonb,
      ${JSON.stringify(session.contextCounts)}::jsonb,
      ${JSON.stringify(websiteKnowledge ? { website_knowledge: websiteKnowledge } : {})}::jsonb,
      ${session.createdAt}::timestamptz, ${session.updatedAt}::timestamptz,
      ${session.expiresAt}::timestamptz, ${clerkUserId}, ${identity.displayName}, ${identity.email}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status, business_name = EXCLUDED.business_name,
      industry = EXCLUDED.industry, website = EXCLUDED.website,
      assistant_configuration = EXCLUDED.assistant_configuration,
      context_counts = EXCLUDED.context_counts,
      internal_fields = CASE WHEN EXCLUDED.internal_fields ? 'website_knowledge' THEN jsonb_set(COALESCE(ai_builder_projects.internal_fields, '{}'::jsonb), '{website_knowledge}', EXCLUDED.internal_fields -> 'website_knowledge', TRUE) ELSE ai_builder_projects.internal_fields END,
      updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at,
      clerk_user_id = COALESCE(ai_builder_projects.clerk_user_id, EXCLUDED.clerk_user_id),
      owner_name = CASE WHEN ai_builder_projects.clerk_user_id IS NULL OR ai_builder_projects.clerk_user_id = ${clerkUserId} THEN COALESCE(NULLIF(ai_builder_projects.owner_name, ''), EXCLUDED.owner_name) ELSE ai_builder_projects.owner_name END,
      owner_email = CASE WHEN ai_builder_projects.clerk_user_id IS NULL OR ai_builder_projects.clerk_user_id = ${clerkUserId} THEN COALESCE(NULLIF(ai_builder_projects.owner_email, ''), EXCLUDED.owner_email) ELSE ai_builder_projects.owner_email END
    WHERE ai_builder_projects.clerk_user_id IS NULL OR ai_builder_projects.clerk_user_id = ${clerkUserId}
  `);

  queries.push(ownershipCollisionGuardQuery(sql, session.id, clerkUserId));

  for (const block of session.intakeBlocks) { queries.push(sql`INSERT INTO ai_builder_intake_blocks (id, project_id, label, content, created_at, updated_at) VALUES (${block.id}, ${session.id}, ${block.label}, ${block.content}, ${block.createdAt}::timestamptz, ${block.updatedAt}::timestamptz) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, content = EXCLUDED.content, updated_at = EXCLUDED.updated_at WHERE ai_builder_intake_blocks.project_id = EXCLUDED.project_id`); queries.push(childOwnershipCollisionGuardQuery(sql, "ai_builder_intake_blocks", block.id, session.id)); }
  for (const entry of session.contextEntries) { queries.push(sql`INSERT INTO ai_builder_context_entries (id, project_id, category, title, content, confidence, confidence_score, status, source, metadata, created_at, updated_at) VALUES (${entry.id}, ${session.id}, ${entry.category}, ${entry.title}, ${entry.content}, ${entry.confidence}, ${entry.confidenceScore}, ${entry.status}, ${JSON.stringify(entry.source)}::jsonb, ${JSON.stringify(entry.metadata)}::jsonb, ${entry.createdAt}::timestamptz, ${entry.updatedAt}::timestamptz) ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, title = EXCLUDED.title, content = EXCLUDED.content, confidence = EXCLUDED.confidence, confidence_score = EXCLUDED.confidence_score, status = EXCLUDED.status, source = EXCLUDED.source, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at WHERE ai_builder_context_entries.project_id = EXCLUDED.project_id`); queries.push(childOwnershipCollisionGuardQuery(sql, "ai_builder_context_entries", entry.id, session.id)); }
  for (const entry of session.faqEntries) { queries.push(sql`INSERT INTO ai_builder_faq_entries (id, project_id, question, answer, confidence, confidence_score, source_entry_ids, status, created_at, updated_at) VALUES (${entry.id}, ${session.id}, ${entry.question}, ${entry.answer}, ${entry.confidence}, ${entry.confidenceScore}, ${JSON.stringify(entry.sourceEntryIds)}::jsonb, ${entry.status}, ${entry.createdAt}::timestamptz, ${entry.updatedAt}::timestamptz) ON CONFLICT (id) DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer, confidence = EXCLUDED.confidence, confidence_score = EXCLUDED.confidence_score, source_entry_ids = EXCLUDED.source_entry_ids, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at WHERE ai_builder_faq_entries.project_id = EXCLUDED.project_id`); queries.push(childOwnershipCollisionGuardQuery(sql, "ai_builder_faq_entries", entry.id, session.id)); }
  for (const conflict of session.conflicts) { queries.push(sql`INSERT INTO ai_builder_conflicts (id, project_id, topic, first_statement, second_statement, source_excerpts, suggested_question, resolved, resolution) VALUES (${conflict.id}, ${session.id}, ${conflict.topic}, ${conflict.firstStatement}, ${conflict.secondStatement}, ${JSON.stringify(conflict.sourceExcerpts)}::jsonb, ${conflict.suggestedQuestion}, ${conflict.resolved}, ${conflict.resolution ?? null}) ON CONFLICT (id) DO UPDATE SET topic = EXCLUDED.topic, first_statement = EXCLUDED.first_statement, second_statement = EXCLUDED.second_statement, source_excerpts = EXCLUDED.source_excerpts, suggested_question = EXCLUDED.suggested_question, resolved = EXCLUDED.resolved, resolution = EXCLUDED.resolution WHERE ai_builder_conflicts.project_id = EXCLUDED.project_id`); queries.push(childOwnershipCollisionGuardQuery(sql, "ai_builder_conflicts", conflict.id, session.id)); }
  for (const item of session.missingInformation) { queries.push(sql`INSERT INTO ai_builder_missing_information (id, project_id, topic, reason, suggested_question, resolved) VALUES (${item.id}, ${session.id}, ${item.topic}, ${item.reason}, ${item.suggestedQuestion}, ${item.resolved}) ON CONFLICT (id) DO UPDATE SET topic = EXCLUDED.topic, reason = EXCLUDED.reason, suggested_question = EXCLUDED.suggested_question, resolved = EXCLUDED.resolved WHERE ai_builder_missing_information.project_id = EXCLUDED.project_id`); queries.push(childOwnershipCollisionGuardQuery(sql, "ai_builder_missing_information", item.id, session.id)); }
  queries.push(sql`DELETE FROM ai_builder_progress WHERE project_id = ${session.id}`);
  for (const progress of session.buildProgress) queries.push(sql`INSERT INTO ai_builder_progress (project_id, stage, message, completed, count, created_at) VALUES (${session.id}, ${progress.stage}, ${progress.message}, ${progress.completed}, ${progress.count ?? null}, ${progress.createdAt}::timestamptz)`);
  queries.push(sql`INSERT INTO ai_builder_chat_threads (id, project_id, title, memory, created_at, updated_at) VALUES (${initialThread.id}, ${session.id}, ${"Demo conversation"}, ${JSON.stringify(initialThread.memory)}::jsonb, ${session.createdAt}::timestamptz, ${session.updatedAt}::timestamptz) ON CONFLICT (id) DO UPDATE SET memory = EXCLUDED.memory, updated_at = EXCLUDED.updated_at WHERE ai_builder_chat_threads.project_id = EXCLUDED.project_id`);
  queries.push(childOwnershipCollisionGuardQuery(sql, "ai_builder_chat_threads", initialThread.id, session.id));
  return queries;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function toNullableIsoString(value: unknown): string | null {
  return value == null ? null : toIsoString(value);
}

export async function persistAiBuilderProjectWithDependencies(
  input: PersistAiBuilderProjectInput,
  dependencies: PersistAiBuilderProjectDependencies,
): Promise<void> {
  const { identity, ensureSchema, sql, writeCanonicalProvenanceShadow } = dependencies;
  await ensureSchema();
  await sql.transaction((tx) => buildLegacyProjectPersistenceQueries(tx, {
    ...input,
    identity,
  }));

  // Provenance is a non-runtime shadow write. A partial failure leaves legacy
  // persistence authoritative; deterministic conflict keys allow a later retry
  // to fill any missing canonical rows without duplicating observations.
  try {
    await writeCanonicalProvenanceShadow({
      projectId: input.session.id,
      session: input.session,
      website: input.website,
      websiteKnowledge: input.websiteKnowledge,
    });
  } catch (error) {
    console.error("AI_BUILDER_CANONICAL_PROVENANCE_SHADOW_FAILED", {
      projectId: input.session.id,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

export async function persistAiBuilderProject(
  input: PersistAiBuilderProjectInput,
): Promise<void> {
  const identity = await requireClerkIdentity();
  return persistAiBuilderProjectWithDependencies(input, {
    identity,
    ensureSchema: ensureAiBuilderSchema,
    sql: getSql(),
    writeCanonicalProvenanceShadow,
  });
}

export async function getAiBuilderProject(
  projectId: string,
): Promise<LoadedAiBuilderProject | null> {
  const identity = await requireClerkIdentity();
  const clerkUserId = identity.userId;
  await ensureAiBuilderSchema();

  const sql = getSql();
  await sql`
    UPDATE ai_builder_projects
    SET owner_name = COALESCE(NULLIF(owner_name, ''), ${identity.displayName}),
        owner_email = COALESCE(NULLIF(owner_email, ''), ${identity.email})
    WHERE id = ${projectId} AND clerk_user_id = ${clerkUserId}
  `;
  const projects = (await sql`
    SELECT
      id,
      status,
      business_name,
      industry,
      website,
      assistant_configuration,
      context_counts,
      created_at,
      updated_at,
      expires_at,
      internal_fields -> 'website_knowledge' AS website_knowledge
    FROM ai_builder_projects
    WHERE id = ${projectId}
      AND clerk_user_id = ${clerkUserId}
      AND archived_at IS NULL
    LIMIT 1
  `) as DatabaseRow[];

  const project = projects[0];
  if (!project) return null;

  const [
    intakeBlocks,
    contextEntries,
    faqEntries,
    conflicts,
    missingInformation,
    buildProgress,
    threads,
  ] = (await Promise.all([
    sql`SELECT * FROM ai_builder_intake_blocks WHERE project_id = ${projectId} ORDER BY created_at, id`,
    sql`SELECT * FROM ai_builder_context_entries WHERE project_id = ${projectId} ORDER BY created_at, id`,
    sql`SELECT * FROM ai_builder_faq_entries WHERE project_id = ${projectId} ORDER BY created_at, id`,
    sql`SELECT * FROM ai_builder_conflicts WHERE project_id = ${projectId} ORDER BY id`,
    sql`SELECT * FROM ai_builder_missing_information WHERE project_id = ${projectId} ORDER BY id`,
    sql`SELECT * FROM ai_builder_progress WHERE project_id = ${projectId} ORDER BY id`,
    sql`SELECT * FROM ai_builder_chat_threads WHERE project_id = ${projectId} ORDER BY created_at LIMIT 1`,
  ])) as [
    DatabaseRow[],
    DatabaseRow[],
    DatabaseRow[],
    DatabaseRow[],
    DatabaseRow[],
    DatabaseRow[],
    DatabaseRow[],
  ];

  const session: AiBuilderSession = {
    id: String(project.id),
    status: project.status as AiBuilderSession["status"],
    intakeBlocks: intakeBlocks.map((row) => ({
      id: String(row.id),
      label: String(row.label),
      content: String(row.content),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    })),
    assistantConfiguration:
      project.assistant_configuration as AiBuilderSession["assistantConfiguration"],
    contextEntries: contextEntries.map((row) => ({
      id: String(row.id),
      sessionId: projectId,
      category: row.category as AiBuilderSession["contextEntries"][number]["category"],
      title: String(row.title),
      content: String(row.content),
      confidence: row.confidence as AiBuilderSession["contextEntries"][number]["confidence"],
      confidenceScore: Number(row.confidence_score),
      status: row.status as AiBuilderSession["contextEntries"][number]["status"],
      source: row.source as AiBuilderSession["contextEntries"][number]["source"],
      metadata: row.metadata as AiBuilderSession["contextEntries"][number]["metadata"],
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    })),
    faqEntries: faqEntries.map((row) => ({
      id: String(row.id),
      sessionId: projectId,
      question: String(row.question),
      answer: String(row.answer),
      confidence: row.confidence as AiBuilderSession["faqEntries"][number]["confidence"],
      confidenceScore: Number(row.confidence_score),
      sourceEntryIds: row.source_entry_ids as string[],
      status: row.status as AiBuilderSession["faqEntries"][number]["status"],
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    })),
    conflicts: conflicts.map((row) => ({
      id: String(row.id),
      topic: String(row.topic),
      firstStatement: String(row.first_statement),
      secondStatement: String(row.second_statement),
      sourceExcerpts: row.source_excerpts as string[],
      suggestedQuestion: String(row.suggested_question),
      resolved: Boolean(row.resolved),
      resolution: row.resolution == null ? null : String(row.resolution),
    })),
    missingInformation: missingInformation.map((row) => ({
      id: String(row.id),
      topic: String(row.topic),
      reason: String(row.reason),
      suggestedQuestion: String(row.suggested_question),
      resolved: Boolean(row.resolved),
    })),
    contextCounts: project.context_counts as AiBuilderSession["contextCounts"],
    buildProgress: buildProgress.map((row) => ({
      stage: row.stage as AiBuilderSession["buildProgress"][number]["stage"],
      message: String(row.message),
      completed: Boolean(row.completed),
      count: row.count == null ? null : Number(row.count),
      createdAt: toIsoString(row.created_at),
    })),
    createdAt: toIsoString(project.created_at),
    updatedAt: toIsoString(project.updated_at),
    expiresAt: toNullableIsoString(project.expires_at),
  };

  const initialThread = threads[0]
    ? {
        id: String(threads[0].id),
        memory: threads[0].memory as ConversationMemory,
      }
    : null;

  return {
    session,
    businessName: String(project.business_name),
    industry: String(project.industry),
    website: project.website == null ? null : String(project.website),
    websiteKnowledge: normalizeWebsiteKnowledge(project.website_knowledge),
    initialThread,
  };
}

export async function listAiBuilderProjects(): Promise<AiBuilderProjectSummary[]> {
  const identity = await requireClerkIdentity();
  const clerkUserId = identity.userId;
  await ensureAiBuilderSchema();
  const sql = getSql();
  await sql`
    UPDATE ai_builder_projects
    SET owner_name = COALESCE(NULLIF(owner_name, ''), ${identity.displayName}),
        owner_email = COALESCE(NULLIF(owner_email, ''), ${identity.email})
    WHERE clerk_user_id = ${clerkUserId}
      AND (owner_name IS NULL OR owner_name = '' OR owner_email IS NULL OR owner_email = '')
  `;
  const rows = (await sql`
    SELECT
      projects.id,
      projects.business_name,
      projects.industry,
      projects.website,
      projects.status,
      projects.created_at,
      projects.updated_at,
      COUNT(messages.id)::integer AS message_count
    FROM ai_builder_projects projects
    LEFT JOIN ai_builder_chat_threads threads ON threads.project_id = projects.id
    LEFT JOIN ai_builder_chat_messages messages ON messages.thread_id = threads.id
    WHERE projects.archived_at IS NULL
      AND projects.clerk_user_id = ${clerkUserId}
    GROUP BY projects.id
    ORDER BY projects.updated_at DESC
  `) as DatabaseRow[];

  return rows.map((row) => ({
    id: String(row.id),
    businessName: String(row.business_name),
    industry: String(row.industry),
    website: row.website == null ? null : String(row.website),
    status: row.status as AiBuilderSession["status"],
    messageCount: Number(row.message_count ?? 0),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }));
}

export async function renameAiBuilderProject(
  projectId: string,
  businessName: string,
): Promise<boolean> {
  const clerkUserId = await requireClerkUserId();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE ai_builder_projects
    SET business_name = ${businessName}, updated_at = NOW()
    WHERE id = ${projectId}
      AND clerk_user_id = ${clerkUserId}
      AND archived_at IS NULL
    RETURNING id
  `) as DatabaseRow[];
  return Boolean(rows[0]);
}

export async function archiveAiBuilderProject(projectId: string): Promise<boolean> {
  const clerkUserId = await requireClerkUserId();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE ai_builder_projects
    SET archived_at = NOW(), updated_at = NOW()
    WHERE id = ${projectId}
      AND clerk_user_id = ${clerkUserId}
      AND archived_at IS NULL
    RETURNING id
  `) as DatabaseRow[];
  return Boolean(rows[0]);
}
