import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

test("the focused verification runner has an explicit architecture-only allow-list", async () => {
  const runner = await readFile(new URL("run-verification.mjs", import.meta.url), "utf8");
  assert.match(runner, /project-migration-state\.test\.ts/);
  assert.match(runner, /review-command-concurrency\.integration\.test\.ts/);
  assert.match(runner, /project-backfill-executor\.test\.ts/);
  assert.match(runner, /assistant-projection\/lifecycle\.test\.ts/);
  assert.match(runner, /assistant-projection\/parity\.test\.ts/);
  assert.match(runner, /cutoverActivation\.test\.ts/);
  assert.match(runner, /operational-events\.test\.ts/);
  assert.doesNotMatch(runner, /app\/.*\*\.test/);
});

test("database verification announces a clear skip when its test URL is absent", async () => {
  const runner = await readFile(new URL("run-verification.mjs", import.meta.url), "utf8");
  assert.match(runner, /DATABASE_URL_TEST is not configured; database-dependent tests will be reported as skipped/);
});

test("the package exposes exactly one focused verification entry point", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.scripts["test:ai-builder-architecture-verification"], "node test/ai-builder-architecture-verification/run-verification.mjs");
});
