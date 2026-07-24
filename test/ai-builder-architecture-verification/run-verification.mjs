import { spawnSync } from "node:child_process";

// This is deliberately an allow-list. Architecture verification must not grow
// when an unrelated repository test is added.
const tests = [
  "app/lib/db/project-migration-state.test.ts",
  "app/lib/db/project-backfill-executor.test.ts",
  "app/lib/db/review-command-concurrency.integration.test.ts",
  "app/lib/ai-engine/assistant-projection/persistence.test.ts",
  "app/lib/ai-engine/assistant-projection/lifecycle.test.ts",
  "app/lib/ai-engine/assistant-projection/parity.test.ts",
  "app/lib/ai-engine/assistant-projection/legacy-compatibility.test.ts",
  "app/lib/ai-engine/assistant-projection/cutover.test.ts",
  "app/lib/ai-engine/assistant-projection/cutoverActivation.test.ts",
  "app/lib/ai-engine/chat/structuredCanonicalRetrieval.test.ts",
  "app/lib/ai-engine/operations/operational-events.test.ts",
  "app/lib/ai-engine/runtime-authority/projectRuntimeAuthority.test.ts",
  "test/ai-builder-architecture-verification/verification-contract.test.ts",
];

if (!process.env.DATABASE_URL_TEST) {
  console.warn("AI Builder architecture verification: DATABASE_URL_TEST is not configured; database-dependent tests will be reported as skipped.");
}

const result = spawnSync(
  process.execPath,
  [
    "--experimental-loader",
    "./test/ai-builder-architecture-verification/typescript-loader.mjs",
    "--test",
    ...tests,
  ],
  { cwd: process.cwd(), env: process.env, stdio: "inherit" },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
