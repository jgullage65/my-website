import assert from "node:assert/strict";
import test from "node:test";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_TEST;

test("DATABASE_URL_TEST supports the Neon ordered transaction batch", {
  skip: databaseUrl ? false : "DATABASE_URL_TEST is not configured",
}, async () => {
  const sql = neon(databaseUrl!);
  const results = await sql.transaction((tx) => [
    tx`SELECT 1 AS first_statement`,
    tx`SELECT 2 AS second_statement`,
  ]);
  assert.equal(results[0]?.[0]?.first_statement, 1);
  assert.equal(results[1]?.[0]?.second_statement, 2);
});
