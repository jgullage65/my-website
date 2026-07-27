# AI Builder crawler production containment contract

Tasks 10–12 use application-level limits and deployment isolation together. The
application bounds input and output, but in-process PDF parsing and Chromium DOM
construction cannot be given a hard memory ceiling by a JavaScript timer.

## Required configuration

- Set `AI_BUILDER_INTERNAL_ORIGIN` to the trusted HTTPS application origin (for
  example `https://builder.example.com`). It must contain no path, credentials,
  query, or fragment. HTTP is accepted only for loopback development.
- Set `CRON_SECRET` independently. The processor sends it only to the endpoint
  derived from `AI_BUILDER_INTERNAL_ORIGIN`; the incoming request host is never
  used as the authenticated destination.

## Required runtime boundary

Production crawl processors must run inside a container or equivalent process
group with all Chromium child processes charged to the same boundary:

- memory limit: **512 MiB**;
- CPU limit: **1 core** per processor;
- wall-clock limit: **15 minutes**;
- process limit: **64**;
- outbound network policy that denies private, loopback, link-local, metadata,
  and cluster-internal address ranges as defense in depth;
- maximum worker concurrency selected so the aggregate of these limits fits the
  service allocation.

The platform must terminate the whole process group on a memory, process, or
wall-clock violation. Crawl-job leases then prevent the terminated worker from
publishing and permit a bounded retry. Running the crawler in an unrestricted
shared application process does **not** satisfy this contract.

PDF.js remains configured with evaluation and font loading disabled and is
bounded by download bytes, page count, extracted characters, and a cooperative
timeout. The container memory/CPU boundary is the hard backstop for synchronous
or allocation-heavy parser behavior.

Chromium retains its sandbox; production must not add `--no-sandbox`. The
renderer additionally disables extensions and background networking, caps the
V8 old-space request, restricts routed destinations, and uses page/time/output
budgets. The container boundary is the hard backstop for native DOM and renderer
memory that V8 flags cannot constrain.

## Required CI verification

Run both commands on every crawler hardening change:

```bash
npm run test:ai-builder-crawler
DATABASE_URL_TEST='postgresql://.../crawler_test' npm run test:ai-builder-crawler-db
```

`test:ai-builder-crawler-db` fails when the dedicated test database is absent,
malformed, not named as a test database, or equal to `DATABASE_URL`. A skipped
database suite is not an acceptable production verification result.
