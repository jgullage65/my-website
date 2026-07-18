import "server-only";

import { notFound } from "next/navigation";

export type AdminPrincipal = {
  id: string;
  email: string;
  role: "admin";
};

/**
 * Clerk integration point.
 *
 * This deliberately returns null until Clerk is installed. Keeping the default
 * closed means admin pages and their data cannot be reached in the meantime.
 */
export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  return null;
}

export async function requireAdmin(): Promise<AdminPrincipal> {
  const principal = await getAdminPrincipal();
  if (!principal || principal.role !== "admin") notFound();
  return principal;
}
