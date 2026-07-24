# AI Builder architecture verification

This report maps the consolidated command to executable repository evidence. A database result is **SKIP** when `DATABASE_URL_TEST` is absent; a skip is not a pass.

Local result (2026-07-24): the focused command passed all 17 test-file workers. `DATABASE_URL_TEST` was absent, so all database-dependent cases—including the new Track 5 integration cases—were skipped rather than counted as verified passes. The repository-wide `tsc --noEmit --incremental false` check still fails on pre-existing stale test fixtures; the new verification files introduced no reported TypeScript error.

| Requirement | Executable evidence | Result | Confirmed defect / external dependency |
| --- | --- | --- | --- |
| Migration correctness | `project-migration-state.test.ts`; `project-backfill-executor.test.ts` | Covered; DB cases environment-dependent | PostgreSQL via `DATABASE_URL_TEST` |
| Runtime consistency | parity, legacy compatibility, and structured canonical retrieval tests | Covered | None confirmed |
| Concurrency behavior | existing review/migration tests; `synchronization-concurrency.integration.test.ts` | Executable; local DB run required | PostgreSQL via `DATABASE_URL_TEST` |
| Telemetry correctness | `synchronization-telemetry.integration.test.ts`; `operations-persistence.integration.test.ts`; existing operational-event tests | Executable; local DB run required | PostgreSQL via `DATABASE_URL_TEST` |
| Rollback scenarios | review command, projection lifecycle, backfill, and cutover activation tests | Covered for listed executable boundaries | PostgreSQL cases require `DATABASE_URL_TEST` |
| Canonical authority validation | existing component tests; `canonical-runtime-request.integration.test.ts` | Executable through the real request boundary; local DB run required | PostgreSQL via `DATABASE_URL_TEST` |

## Detailed mapping

- Migration transitions, revision conflicts, replay mismatch, failure recording/resume, terminal retirement, history, artifacts, and concurrent transition serialization are exercised by `project-migration-state.test.ts` and `project-backfill-executor.test.ts`.
- Equivalent legacy/canonical material, `MATCH`, deterministic adaptation, and rejection of archived/non-authoritative projection content are exercised by parity, legacy-compatibility, persistence, and structured retrieval tests.
- Same-revision governance mutation and duplicate command replay are exercised by `review-command-concurrency.integration.test.ts`.
- Transaction rollback for review commands, Business Memory, Assistant Projection, migration, and cutover is exercised by the listed backfill/persistence/lifecycle tests.
- Missing/stale/invalid projections, version and fingerprint mismatches, non-`MATCH` parity, artifact-bound parity evidence, and controlled cutover rejection are exercised by persistence, lifecycle, cutover, and retrieval tests.
- Concurrent claim, `SKIP LOCKED` retry-worker, and runtime-mismatch deduplication races are exercised by `synchronization-concurrency.integration.test.ts` against PostgreSQL durable rows.
- Commit/rollback event ordering, success/failure scheduling, stale recovery, dead-letter reopen, and telemetry-failure isolation are exercised by `synchronization-telemetry.integration.test.ts`.
- Persisted drift signature replacement and dashboard authority with absent or misleading events are exercised by `operations-persistence.integration.test.ts`.
- The real chat request boundary exercises missing, invalidated, rebuilding, unsupported, malformed, fingerprint-mismatched, stale/non-MATCH/wrong-artifact parity, archived knowledge, migration, and runtime-authority mismatch rejection in `canonical-runtime-request.integration.test.ts`.

## Intentionally unverified locally

No database-backed requirement is reported as locally passed solely from this document. The new cases require execution with `DATABASE_URL_TEST` before Track 5 can be declared passed.

Remaining repository test debt outside this focused phase:

- four pre-existing files have stale assertions against the completed architecture and are not evidence in this suite: `buildAssistantProjection.test.ts` expects the pre-v3 service bucket, `rebuild-persisted-business-memory.test.ts` has an incomplete query harness, `ai-builder-repository.test.ts` expects superseded reconciliation statements, and `route.orchestration.test.ts` expects a comparison result for a fixture now rejected by validation.
- `ai-builder-state-concurrency.integration.test.ts` reads `DATABASE_URL` and does not implement the required clear `DATABASE_URL_TEST` skip, so it is excluded from this phase.

## Confirmed defects

- Canonical cutover eligibility did not compare parity evidence's recorded runtime authority with the requested runtime authority. `cutover.ts` now rejects this as `assistant_projection_runtime_unavailable_parity_authority_mismatch`.
- Corrupt persisted projection parsing errors could escape the runtime loader as internal codes and receive an uncontrolled generic 500 response. The chat runtime boundary now converts non-runtime projection validation failures to `assistant_projection_runtime_unavailable_validation_failure` after rollback and mismatch telemetry.
