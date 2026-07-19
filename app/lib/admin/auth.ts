import "server-only";

import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

export type AdminPrincipal = {
  id: string;
  email: string;
  role: "admin";
};

/** Server-verified Clerk public metadata is the admin authorization source. */
export async function getAdminPrincipal(): Promise<AdminPrincipal | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const claimMetadata = sessionClaims?.metadata as
    | Record<string, unknown>
    | undefined;
  let role = claimMetadata?.role;
  let email =
    typeof sessionClaims?.primaryEmail === "string"
      ? sessionClaims.primaryEmail
      : null;

  if (role !== "admin" || !email) {
    const user = await currentUser();
    role = user?.publicMetadata?.role;
    email ??= user?.primaryEmailAddress?.emailAddress ?? null;
  }
  if (role !== "admin" || !email) return null;

  return { id: userId, email, role: "admin" };
}

export async function requireAdmin(): Promise<AdminPrincipal> {
  const principal = await getAdminPrincipal();
  if (!principal || principal.role !== "admin") notFound();
  return principal;
}
