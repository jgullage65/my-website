# AI Builder production integration tests

The Postgres integration suite is `app/lib/db/review-command-concurrency.integration.test.ts` and is included by `npm run test:ai-builder-db`.

CI must provide `DATABASE_URL_TEST` for an isolated Neon/Postgres database. The suite intentionally skips when that variable is absent so a developer's production `DATABASE_URL` is never used for destructive test setup. The test role must be able to create the AI Builder schema and insert/delete isolated rows. CI should treat a skipped integration suite as a configuration failure for production deployment jobs.

The suite covers unsupported legacy-mutation rejection, concurrent command replay, duplicate approval attempts, complete context/FAQ counters, atomic multi-command rollback, absence of partial history/ledger/item writes after rollback, and the lifetime project limit including archived projects.
