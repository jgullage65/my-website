import "server-only";

import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (cachedSql) return cachedSql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  cachedSql = neon(connectionString);
  return cachedSql;
}
