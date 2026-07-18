import "server-only";

import { requireAdmin } from "./auth";

export type ImpersonationCapability = { available: false; reason: string } | { available: true };

export async function getImpersonationCapability(): Promise<ImpersonationCapability> {
  await requireAdmin();
  return { available: false, reason: "Connect the Clerk server SDK before impersonation can be enabled." };
}

/** Clerk integration boundary. Never replace this with a local cookie or project-id override. */
export async function beginCustomerImpersonation(_customerId: string): Promise<never> {
  await requireAdmin();
  throw new Error("Clerk impersonation is not configured.");
}
