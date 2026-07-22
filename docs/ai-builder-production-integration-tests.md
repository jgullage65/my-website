# AI Builder PostgreSQL review-command integration tests

The Phase 6 PostgreSQL integration suite is `app/lib/db/review-command-concurrency.integration.test.ts`.

## Required test database setup

Create a dedicated PostgreSQL database whose name includes `test` (for example,
`my_website_review_test`) and grant its test role DDL plus insert/delete rights.
Set **only** that database URL as `DATABASE_URL_TEST`; it must not equal
`DATABASE_URL`. The test runner assigns `DATABASE_URL` from this value only for
its child test process, so schema setup and all destructive rows stay in the
dedicated test database.

```bash
export DATABASE_URL_TEST='postgresql://review_test_role:password@localhost:5432/my_website_review_test'
npm run test:ai-builder-review-db
```

The command fails before test startup when the variable is missing, equals
`DATABASE_URL`, is malformed, or its database name does not identify a test
database. This is intentional: a skipped database test is not Phase 6
verification. `ensureAiBuilderSchema()` is run by the suite before fixtures are
created and is idempotent; every test creates UUID-scoped fixtures and removes
its project (with cascading dependent rows), so repeated runs start from a
deterministic logical state.

The database commands use Node's `--experimental-transform-types` mode rather
than strip-only mode because the integration path imports TypeScript parameter
properties that strip-only mode cannot execute on the repository's Node 24
runtime.

Run the command repeatedly in CI (at least five times) to detect nondeterministic
locking failures:

```bash
for run in 1 2 3 4 5; do npm run test:ai-builder-review-db || exit 1; done
```

The suite covers unsupported legacy-mutation rejection, genuinely concurrent
duplicate-command replay, competing revision writes, counters/readiness,
atomic multi-command rollback, and absence of partial history/ledger/item
writes after rollback. The broader `npm run test:ai-builder-db` command remains
useful for all database tests, but is not a substitute for the strict Phase 6
command because its integration tests can be skipped when no test database is
configured.
