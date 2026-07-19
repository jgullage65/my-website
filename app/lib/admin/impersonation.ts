import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { ensureAiBuilderSchema } from "@/app/lib/db/ai-builder-schema";
import { getSql } from "@/app/lib/db/client";
import { requireAdmin } from "./auth";

type Row = Record<string, unknown>;
type Target = { projectId: string; customerId: string; customerEmail: string | null };

export type ImpersonationCapability =
  | { available: false; reason: string }
  | { available: true; customerId: string; customerEmail: string | null };

const errorMessage = (error: unknown) => {
  if (error && typeof error === "object") {
    const candidate = error as { status?: number; errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
    if (candidate.status === 402) return "Clerk impersonation is not enabled for this production instance or its monthly allowance has been exhausted.";
    return candidate.errors?.[0]?.longMessage || candidate.errors?.[0]?.message || candidate.message || "Clerk rejected the impersonation request.";
  }
  return "Clerk rejected the impersonation request.";
};

async function getTarget(projectId: string): Promise<Target | null> {
  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, clerk_user_id, owner_email
    FROM ai_builder_projects
    WHERE id = ${projectId} AND archived_at IS NULL
    LIMIT 1
  ` as Row[];
  const row = rows[0];
  if (!row?.clerk_user_id) return null;
  return {
    projectId: String(row.id),
    customerId: String(row.clerk_user_id),
    customerEmail: row.owner_email == null ? null : String(row.owner_email),
  };
}

async function logEvent(input: {
  adminId: string; adminEmail: string; customerId: string;
  customerEmail: string | null; projectId: string | null;
  eventType: "started" | "stopped" | "failed"; metadata?: Record<string, unknown>;
}) {
  await ensureAiBuilderSchema();
  const sql = getSql();
  await sql`
    INSERT INTO ai_builder_impersonation_events
      (id, admin_id, admin_email, customer_id, customer_email, project_id, event_type, metadata)
    VALUES
      (${crypto.randomUUID()}, ${input.adminId}, ${input.adminEmail}, ${input.customerId},
       ${input.customerEmail}, ${input.projectId}, ${input.eventType}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `;
}

const hasProductionClerkKeys = () =>
  process.env.CLERK_SECRET_KEY?.startsWith("sk_live_") === true &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") === true;

export async function getImpersonationCapability(projectId: string): Promise<ImpersonationCapability> {
  const admin = await requireAdmin();
  if (!hasProductionClerkKeys()) {
    return { available: false, reason: "Impersonation is disabled because this deployment is not configured with Clerk production keys." };
  }

  const target = await getTarget(projectId);
  if (!target) return { available: false, reason: "This project has no authenticated Clerk customer account to impersonate." };
  if (target.customerId === admin.id) return { available: false, reason: "You cannot impersonate your own administrator account." };

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(target.customerId);
    if (user.publicMetadata?.role === "admin") {
      return { available: false, reason: "Administrator accounts cannot be impersonated." };
    }
    return {
      available: true,
      customerId: target.customerId,
      customerEmail: user.primaryEmailAddress?.emailAddress ?? target.customerEmail,
    };
  } catch (error) {
    return { available: false, reason: `The target customer could not be verified in Clerk: ${errorMessage(error)}` };
  }
}

/** Creates Clerk's official one-time actor token after re-validating all server-side identities. */
export async function beginCustomerImpersonation(projectId: string): Promise<{ token: string }> {
  const admin = await requireAdmin();
  const target = await getTarget(projectId);
  if (!target) throw new Error("This project has no authenticated Clerk customer account.");

  let customerEmail = target.customerEmail;
  try {
    if (!hasProductionClerkKeys()) throw new Error("Impersonation requires Clerk production keys.");
    if (target.customerId === admin.id) throw new Error("You cannot impersonate your own administrator account.");
    const client = await clerkClient();
    const customer = await client.users.getUser(target.customerId);
    customerEmail = customer.primaryEmailAddress?.emailAddress ?? customerEmail;
    if (customer.publicMetadata?.role === "admin") throw new Error("Administrator accounts cannot be impersonated.");

    const token = await client.actorTokens.create({
      userId: target.customerId,
      actor: { sub: admin.id },
      expiresInSeconds: 300,
      sessionMaxDurationInSeconds: 1800,
    });
    if (!token.token) throw new Error("Clerk did not return an actor token.");

    await logEvent({
      adminId: admin.id, adminEmail: admin.email, customerId: target.customerId,
      customerEmail, projectId: target.projectId, eventType: "started",
      metadata: { actorTokenId: token.id },
    });
    return { token: token.token };
  } catch (error) {
    await logEvent({
      adminId: admin.id, adminEmail: admin.email, customerId: target.customerId,
      customerEmail, projectId: target.projectId, eventType: "failed",
      metadata: { reason: errorMessage(error) },
    });
    throw new Error(errorMessage(error));
  }
}

/** Records a stop only for a Clerk-signed impersonated session whose actor is still an admin. */
export async function recordCustomerImpersonationStopped(): Promise<void> {
  const session = await auth();
  const actorId = session.actor?.sub;
  const customerId = session.userId;
  if (!actorId || !customerId) throw new Error("No active Clerk impersonation session was found.");

  const client = await clerkClient();
  const [actor, customer] = await Promise.all([
    client.users.getUser(actorId),
    client.users.getUser(customerId),
  ]);
  if (actor.publicMetadata?.role !== "admin") throw new Error("The Clerk actor is not an administrator.");

  await ensureAiBuilderSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT project_id FROM ai_builder_impersonation_events
    WHERE admin_id = ${actorId} AND customer_id = ${customerId} AND event_type = 'started'
    ORDER BY occurred_at DESC LIMIT 1
  ` as Row[];
  await logEvent({
    adminId: actorId,
    adminEmail: actor.primaryEmailAddress?.emailAddress ?? "unavailable",
    customerId,
    customerEmail: customer.primaryEmailAddress?.emailAddress ?? null,
    projectId: rows[0]?.project_id == null ? null : String(rows[0].project_id),
    eventType: "stopped",
    metadata: { clerkSessionId: session.sessionId },
  });
}
