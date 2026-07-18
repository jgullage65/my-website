import "server-only";

import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { requireAdmin } from "./auth";

type Row = Record<string, unknown>;
export type AdminProject = {
  id: string; businessName: string; industry: string; ownerName: string | null;
  ownerEmail: string | null; status: string; website: string | null;
  knowledgeCount: number; faqCount: number; purchaseRequested: boolean;
  createdAt: string; updatedAt: string;
};
export type AdminUser = {
  email: string; ownerName: string; businessName: string; createdAt: string;
  projectCount: number; purchaseStatus: string; lastActivity: string;
};
export type AdminPurchase = {
  id: string; projectId: string; businessName: string; ownerName: string | null;
  email: string | null; status: string; followUpStage: string;
  internalComments: string | null; createdAt: string; updatedAt: string;
};
export type AdminActivity = {
  id: string; kind: "user" | "project" | "purchase" | "crawl" | "generation";
  label: string; detail: string; occurredAt: string; projectId?: string;
};
export const PURCHASE_STAGES = ["new", "contacted", "demo_scheduled", "waiting_on_customer", "completed"] as const;

const iso = (value: unknown) => new Date(String(value)).toISOString();
const text = (value: unknown) => value == null ? null : String(value);

export async function listAdminProjects(): Promise<AdminProject[]> {
  await requireAdmin();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT p.id, p.business_name, p.industry, p.owner_name, p.owner_email,
      p.status, p.website, p.created_at, p.updated_at,
      COUNT(DISTINCT k.id)::integer AS knowledge_count,
      COUNT(DISTINCT f.id)::integer AS faq_count,
      (COUNT(DISTINCT pi.id) > 0) AS purchase_requested
    FROM ai_builder_projects p
    LEFT JOIN ai_builder_context_entries k ON k.project_id = p.id AND k.status <> 'archived'
    LEFT JOIN ai_builder_faq_entries f ON f.project_id = p.id AND f.status <> 'archived'
    LEFT JOIN ai_builder_purchase_interest pi ON pi.project_id = p.id
    WHERE p.archived_at IS NULL
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  ` as Row[];
  return rows.map((r) => ({
    id: String(r.id), businessName: String(r.business_name), industry: String(r.industry),
    ownerName: text(r.owner_name), ownerEmail: text(r.owner_email), status: String(r.status),
    website: text(r.website), knowledgeCount: Number(r.knowledge_count), faqCount: Number(r.faq_count),
    purchaseRequested: Boolean(r.purchase_requested), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
  }));
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  await requireAdmin();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT p.owner_email, MAX(p.owner_name) AS owner_name,
      MIN(p.business_name) AS business_name, MIN(p.created_at) AS created_at,
      MAX(p.updated_at) AS last_activity, COUNT(DISTINCT p.id)::integer AS project_count,
      COALESCE(MAX(pi.status), 'none') AS purchase_status
    FROM ai_builder_projects p
    LEFT JOIN ai_builder_purchase_interest pi ON pi.project_id = p.id
    WHERE p.archived_at IS NULL AND p.owner_email IS NOT NULL
    GROUP BY p.owner_email
    ORDER BY MAX(p.updated_at) DESC
  ` as Row[];
  return rows.map((r) => ({
    email: String(r.owner_email), ownerName: String(r.owner_name || "Not provided"),
    businessName: String(r.business_name), createdAt: iso(r.created_at),
    projectCount: Number(r.project_count), purchaseStatus: String(r.purchase_status),
    lastActivity: iso(r.last_activity),
  }));
}

export async function listAdminPurchases(): Promise<AdminPurchase[]> {
  await requireAdmin();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT pi.id, pi.project_id, pi.status, pi.follow_up_stage,
      pi.internal_comments, pi.created_at, pi.updated_at, p.business_name,
      p.owner_name, p.owner_email
    FROM ai_builder_purchase_interest pi
    JOIN ai_builder_projects p ON p.id = pi.project_id
    WHERE p.archived_at IS NULL ORDER BY pi.created_at DESC
  ` as Row[];
  return rows.map((r) => ({ id: String(r.id), projectId: String(r.project_id),
    businessName: String(r.business_name), ownerName: text(r.owner_name), email: text(r.owner_email),
    status: String(r.status), followUpStage: String(r.follow_up_stage),
    internalComments: text(r.internal_comments), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }));
}

export async function getAdminOverview() {
  await requireAdmin();
  const [projects, users, purchases, activity] = await Promise.all([
    listAdminProjects(), listAdminUsers(), listAdminPurchases(), listAdminActivity(),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return { users: users.length, projects: projects.length,
    activeProjects: projects.filter((p) => !["failed", "expired"].includes(p.status)).length,
    purchases: purchases.length,
    createdToday: projects.filter((p) => new Date(p.createdAt) >= today).length,
    activity };
}

export async function listAdminActivity(): Promise<AdminActivity[]> {
  await requireAdmin();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM (
      SELECT 'project' AS kind, p.id::text AS id, p.id AS project_id,
        'New project' AS label, p.business_name AS detail, p.created_at AS occurred_at
      FROM ai_builder_projects p WHERE p.archived_at IS NULL
      UNION ALL
      SELECT 'purchase', pi.id::text, pi.project_id, 'Purchase request', p.business_name, pi.created_at
      FROM ai_builder_purchase_interest pi JOIN ai_builder_projects p ON p.id = pi.project_id
      UNION ALL
      SELECT 'crawl', p.id::text, p.id, 'Website crawl completed', p.business_name, p.created_at
      FROM ai_builder_projects p WHERE p.website IS NOT NULL AND p.archived_at IS NULL
      UNION ALL
      SELECT 'generation', p.id::text, p.id, 'AI generation completed', p.business_name, p.updated_at
      FROM ai_builder_projects p WHERE p.status = 'ready' AND p.archived_at IS NULL
      UNION ALL
      SELECT 'user', p.owner_email, MIN(p.id), 'New user', COALESCE(p.owner_name, p.owner_email), MIN(p.created_at)
      FROM ai_builder_projects p WHERE p.owner_email IS NOT NULL
      GROUP BY p.owner_email, p.owner_name
    ) events ORDER BY occurred_at DESC LIMIT 30
  ` as Row[];
  return rows.map((r) => ({ id: `${r.kind}-${r.id}`, kind: r.kind as AdminActivity["kind"],
    label: String(r.label), detail: String(r.detail), occurredAt: iso(r.occurred_at),
    projectId: r.project_id == null ? undefined : String(r.project_id) }));
}

export async function getAdminProjectDetail(projectId: string) {
  await requireAdmin();
  await ensureAiBuilderSchema();
  const sql = getSql();
  const projects = await sql`SELECT * FROM ai_builder_projects WHERE id = ${projectId} AND archived_at IS NULL LIMIT 1` as Row[];
  if (!projects[0]) return null;
  const [knowledge, faqs, progress, threads, purchases, intake, notes, communications, crawlTelemetry, generationTelemetry] = await Promise.all([
    sql`SELECT * FROM ai_builder_context_entries WHERE project_id = ${projectId} ORDER BY created_at`,
    sql`SELECT * FROM ai_builder_faq_entries WHERE project_id = ${projectId} ORDER BY created_at`,
    sql`SELECT * FROM ai_builder_progress WHERE project_id = ${projectId} ORDER BY id`,
    sql`SELECT t.id, t.title, t.created_at, m.role, m.content, m.created_at AS message_created_at FROM ai_builder_chat_threads t LEFT JOIN ai_builder_chat_messages m ON m.thread_id = t.id WHERE t.project_id = ${projectId} ORDER BY t.created_at, m.created_at`,
    sql`SELECT * FROM ai_builder_purchase_interest WHERE project_id = ${projectId} ORDER BY created_at DESC`,
    sql`SELECT * FROM ai_builder_intake_blocks WHERE project_id = ${projectId} ORDER BY created_at`,
    sql`SELECT * FROM ai_builder_admin_notes WHERE project_id = ${projectId} ORDER BY created_at DESC`,
    sql`SELECT * FROM ai_builder_communications WHERE project_id = ${projectId} ORDER BY sent_at DESC`,
    sql`SELECT * FROM ai_builder_crawl_telemetry WHERE project_id = ${projectId} ORDER BY started_at DESC`,
    sql`SELECT * FROM ai_builder_generation_telemetry WHERE project_id = ${projectId} ORDER BY started_at DESC`,
  ]) as Row[][];
  const p = projects[0];
  return { project: { id: String(p.id), businessName: String(p.business_name), industry: String(p.industry),
      website: text(p.website), ownerName: text(p.owner_name), ownerEmail: text(p.owner_email), status: String(p.status),
      configuration: p.assistant_configuration, counts: p.context_counts,
      internalStatus: text(p.internal_status), internalFields: p.internal_fields,
      createdAt: iso(p.created_at), updatedAt: iso(p.updated_at), expiresAt: p.expires_at ? iso(p.expires_at) : null },
    knowledge, faqs, progress, threads, purchases, intake, notes, communications, crawlTelemetry, generationTelemetry };
}

export async function updateAdminProject(projectId: string, input: {
  businessName: string; ownerName: string | null; ownerEmail: string | null;
  website: string | null; internalStatus: string | null; internalSummary: string | null;
}) {
  await requireAdmin(); await ensureAiBuilderSchema(); const sql = getSql();
  const rows = await sql`
    UPDATE ai_builder_projects SET business_name = ${input.businessName},
      owner_name = ${input.ownerName}, owner_email = ${input.ownerEmail},
      website = ${input.website}, internal_status = ${input.internalStatus},
      internal_fields = CASE
        WHEN ${input.internalSummary}::text IS NULL
          THEN COALESCE(internal_fields, '{}'::jsonb) - 'summary'
        ELSE jsonb_set(
          COALESCE(internal_fields, '{}'::jsonb),
          '{summary}',
          to_jsonb(${input.internalSummary}::text),
          TRUE
        )
      END,
      updated_at = NOW()
    WHERE id = ${projectId} AND archived_at IS NULL RETURNING id
  ` as Row[];
  return Boolean(rows[0]);
}

export async function createAdminNote(projectId: string, content: string) {
  const admin = await requireAdmin(); await ensureAiBuilderSchema(); const sql = getSql();
  await sql`INSERT INTO ai_builder_admin_notes (id, project_id, content, author_id, author_email)
    VALUES (${crypto.randomUUID()}, ${projectId}, ${content}, ${admin.id}, ${admin.email})`;
}

export async function updateAdminNote(noteId: string, projectId: string, content: string) {
  await requireAdmin(); await ensureAiBuilderSchema(); const sql = getSql();
  await sql`UPDATE ai_builder_admin_notes SET content = ${content}, updated_at = NOW()
    WHERE id = ${noteId} AND project_id = ${projectId}`;
}

export async function deleteAdminNote(noteId: string, projectId: string) {
  await requireAdmin(); await ensureAiBuilderSchema(); const sql = getSql();
  await sql`DELETE FROM ai_builder_admin_notes WHERE id = ${noteId} AND project_id = ${projectId}`;
}

export async function updateAdminPurchase(purchaseId: string, input: {
  status: string; followUpStage: string; internalComments: string | null;
}) {
  await requireAdmin(); await ensureAiBuilderSchema(); const sql = getSql();
  await sql`UPDATE ai_builder_purchase_interest SET status = ${input.status},
    follow_up_stage = ${input.followUpStage}, internal_comments = ${input.internalComments},
    updated_at = NOW() WHERE id = ${purchaseId}`;
}
