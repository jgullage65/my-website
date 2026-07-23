import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL_TEST;

if (!databaseUrl) {
  console.error("DATABASE_URL_TEST is required. Refusing to run destructive PostgreSQL review-command tests without it.");
  process.exit(1);
}

if (databaseUrl === process.env.DATABASE_URL) {
  console.error("DATABASE_URL_TEST must not be the same value as DATABASE_URL.");
  process.exit(1);
}

let databaseName;
try {
  databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
} catch {
  console.error("DATABASE_URL_TEST must be a valid PostgreSQL connection URL.");
  process.exit(1);
}

if (!/(^|[-_])test($|[-_])|_test$/i.test(databaseName)) {
  console.error(`DATABASE_URL_TEST must name a dedicated test database (received ${JSON.stringify(databaseName)}).`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  "--experimental-transform-types",
  "--experimental-loader", "./test/node-alias-loader.mjs",
  "--test", "app/lib/db/review-command-concurrency.integration.test.ts", "app/lib/ai-engine/assistant-projection/persistence.test.ts", "app/lib/ai-engine/assistant-projection/lifecycle.test.ts", "app/lib/ai-engine/business-memory/persistence/rebuild-persisted-business-memory.test.ts", "app/lib/db/project-backfill-executor.test.ts",
], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

process.exit(result.status ?? 1);
