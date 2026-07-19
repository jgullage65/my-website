import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

export type AuthenticatedClerkIdentity = {
  userId: string;
  email: string | null;
  displayName: string;
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("authentication_required");
    this.name = "AuthenticationRequiredError";
  }
}

export async function requireClerkUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new AuthenticationRequiredError();
  return userId;
}

const claimString = (claims: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

/** Resolves identity exclusively from Clerk's verified session and Backend API. */
export async function requireClerkIdentity(): Promise<AuthenticatedClerkIdentity> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new AuthenticationRequiredError();

  const claims = (sessionClaims ?? {}) as Record<string, unknown>;
  let email = claimString(claims, "primaryEmail", "email");
  let fullName = claimString(claims, "fullName", "name");
  let firstName = claimString(claims, "firstName", "first_name");
  let lastName = claimString(claims, "lastName", "last_name");
  let username = claimString(claims, "username");

  if (!email || (!fullName && !firstName && !lastName && !username)) {
    const user = await currentUser();
    if (user?.id === userId) {
      email ??= user.primaryEmailAddress?.emailAddress ?? null;
      fullName ??= user.fullName;
      firstName ??= user.firstName;
      lastName ??= user.lastName;
      username ??= user.username;
    }
  }

  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    userId,
    email,
    displayName: fullName || combinedName || username || email || "Clerk user",
  };
}

export function isAuthenticationRequired(error: unknown): boolean {
  return error instanceof AuthenticationRequiredError;
}
