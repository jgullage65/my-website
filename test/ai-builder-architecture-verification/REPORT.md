# AI Builder architecture verification

This report maps the consolidated command to executable repository evidence. A database result is **SKIP** when `DATABASE_URL_TEST` is absent; a skip is not a pass.

Local result (2026-07-24): the focused command passed all 13 test-file workers. `DATABASE_URL_TEST` was absent, so database-dependent cases inside the migration, backfill, projection persistence/lifecycle, and review-concurrency files were skipped. The repository-wide `tsc --noEmit` check failed on pre-existing stale test fixtures; the new verification files introduced no reported TypeScript error.

| Requirement | Executable evidence | Result | Confirmed defect / external dependency |
| --- | --- | --- | --- |
| Migration correctness | `project-migration-state.test.ts`; `project-backfill-executor.test.ts` | Covered; DB cases environment-dependent | PostgreSQL via `DATABASE_URL_TEST` |
| Runtime consistency | parity, legacy compatibility, and structured canonical retrieval tests | Covered | None confirmed |
| Concurrency behavior | review-command, project-state, and migration/backfill concurrency tests | Partially covered | Synchronization claim/retry-worker and runtime-mismatch write races still require DB verification |
| Telemetry correctness | operational-events, projection lifecycle, and cutover activation tests | Partially covered | Synchronization commit-order lifecycle telemetry and dashboard durable-table authority are not yet proved end-to-end |
| Rollback scenarios | review command, projection lifecycle, backfill, and cutover activation tests | Covered for listed executable boundaries | PostgreSQL cases require `DATABASE_URL_TEST` |
| Canonical authority validation | persistence, lifecycle, parity, cutover, canonical retrieval, runtime authority, and orchestration tests | Covered at component boundaries | The private chat runtime loader is not exercised as a full database-backed request |

## Detailed mapping

- Migration transitions, revision conflicts, replay mismatch, failure recording/resume, terminal retirement, history, artifacts, and concurrent transition serialization are exercised by `project-migration-state.test.ts` and `project-backfill-executor.test.ts`.
- Equivalent legacy/canonical material, `MATCH`, deterministic adaptation, and rejection of archived/non-authoritative projection content are exercised by parity, legacy-compatibility, persistence, and structured retrieval tests.
- Same-revision governance mutation and duplicate command replay are exercised by `review-command-concurrency.integration.test.ts`.
- Transaction rollback for review commands, Business Memory, Assistant Projection, migration, and cutover is exercised by the listed backfill/persistence/lifecycle tests.
- Missing/stale/invalid projections, version and fingerprint mismatches, non-`MATCH` parity, artifact-bound parity evidence, and controlled cutover rejection are exercised by persistence, lifecycle, cutover, and retrieval tests.
- Drift resolution is exercised by `operational-events.test.ts`; operational event rows remain observability rather than runtime authority by the parity persistence and runtime-authority component tests.

## Intentionally unverified locally

No requirement is reported as passed solely from this document. The following still need executable coverage before the corresponding rows can be marked fully passed:

- concurrent synchronization claims and eligible retry workers using `SKIP LOCKED`;
- synchronization lifecycle telemetry at every commit/rollback boundary, including stale recovery and dead-letter reopen;
- atomic concurrent runtime-mismatch deduplication and signature replacement resolution;
- dashboard authority derived end-to-end from durable domain tables;
- the complete canonical chat loader rejection matrix through a real request and PostgreSQL transaction.
- four pre-existing files have stale assertions against the completed architecture and are not evidence in this suite: `buildAssistantProjection.test.ts` expects the pre-v3 service bucket, `rebuild-persisted-business-memory.test.ts` has an incomplete query harness, `ai-builder-repository.test.ts` expects superseded reconciliation statements, and `route.orchestration.test.ts` expects a comparison result for a fixture now rejected by validation.
- `ai-builder-state-concurrency.integration.test.ts` reads `DATABASE_URL` and does not implement the required clear `DATABASE_URL_TEST` skip, so it is excluded from this phase.
