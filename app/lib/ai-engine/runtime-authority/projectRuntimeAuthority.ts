import "server-only";

import { Pool, type PoolClient } from "@neondatabase/serverless";

export const PROJECT_RUNTIME_AUTHORITIES = ["legacy", "canonical"] as const;
export type ProjectRuntimeAuthority = (typeof PROJECT_RUNTIME_AUTHORITIES)[number];
type QueryClient = Pick<PoolClient, "query">;

export class ProjectRuntimeAuthorityError extends Error {
  readonly code: "project_runtime_authority_invalid" | "project_runtime_authority_project_not_found";
  constructor(code: "project_runtime_authority_invalid" | "project_runtime_authority_project_not_found") {
    super(code);
    this.code = code;
    this.name = "ProjectRuntimeAuthorityError";
  }
}

export function parseProjectRuntimeAuthority(value: unknown): ProjectRuntimeAuthority {
  if (value === "legacy" || value === "canonical") return value;
  throw new ProjectRuntimeAuthorityError("project_runtime_authority_invalid");
}

/** Reads the durable, project-scoped source of runtime authority. */
export async function getProjectRuntimeAuthority(client: QueryClient, projectId: string): Promise<ProjectRuntimeAuthority> {
  const result = await client.query("SELECT runtime_authority FROM ai_builder_projects WHERE id=$1", [projectId]);
  const row = result.rows[0] as { runtime_authority?: unknown } | undefined;
  if (!row) throw new ProjectRuntimeAuthorityError("project_runtime_authority_project_not_found");
  return parseProjectRuntimeAuthority(row.runtime_authority);
}

/** Owner-scoped server boundary. This changes only authority and updated_at. */
let pool: Pool | null = null;
const authorityPool = () => (pool ??= new Pool({ connectionString: process.env.DATABASE_URL }));
export async function setProjectRuntimeAuthority(input: { projectId: string; clerkUserId: string; authority: ProjectRuntimeAuthority }): Promise<ProjectRuntimeAuthority> {
  const authority = parseProjectRuntimeAuthority(input.authority);
  const client = await authorityPool().connect();
  try {
    const result = await client.query("UPDATE ai_builder_projects SET runtime_authority=$3,updated_at=NOW() WHERE id=$1 AND clerk_user_id=$2 RETURNING runtime_authority", [input.projectId, input.clerkUserId, authority]);
    const row = result.rows[0] as { runtime_authority?: unknown } | undefined;
    if (!row) throw new ProjectRuntimeAuthorityError("project_runtime_authority_project_not_found");
    return parseProjectRuntimeAuthority(row.runtime_authority);
  } finally { client.release(); }
}
