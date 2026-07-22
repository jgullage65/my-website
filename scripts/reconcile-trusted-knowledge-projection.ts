import { Pool } from "@neondatabase/serverless";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { reconcileTrustedKnowledgeProjectionForProject } from "@/app/lib/ai-engine/knowledge/trustedKnowledgeProjection";

const projectId = process.argv.find((argument) => argument.startsWith("--project-id="))?.slice("--project-id=".length);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

async function main() {
  await ensureAiBuilderSchema();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const projects = (await pool.query(`SELECT id, governance_revision FROM ai_builder_projects WHERE archived_at IS NULL ${projectId ? "AND id = $1" : ""} ORDER BY id`, projectId ? [projectId] : [])).rows as Array<{ id: string; governance_revision: number }>;
  let reconciled = 0; let failed = 0;
  for (const project of projects) { const client = await pool.connect(); try { await client.query("BEGIN"); await reconcileTrustedKnowledgeProjectionForProject(client, project.id, Number(project.governance_revision)); await client.query("COMMIT"); reconciled += 1; } catch (error) { await client.query("ROLLBACK").catch(() => undefined); failed += 1; console.error(`trusted-knowledge reconciliation failed for ${project.id}`, error instanceof Error ? error.message : "unknown error"); } finally { client.release(); } }
  console.log(JSON.stringify({ projectsScanned: projects.length, projectsReconciled: reconciled, projectsSkipped: 0, projectsFailed: failed }));
  await pool.end(); if (failed) process.exitCode = 1;
}
void main();
