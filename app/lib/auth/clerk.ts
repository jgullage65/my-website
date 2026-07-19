import "server-only";

import { auth } from "@clerk/nextjs/server";

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

export function isAuthenticationRequired(error: unknown): boolean {
  return error instanceof AuthenticationRequiredError;
}
