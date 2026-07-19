export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "admin";
    };
    primaryEmail?: string;
  }
}
