# Public research corrective review — October 15, 2026

This is the consolidated report for the targeted five-finding correction. Continue the existing draft PRs: [crawler #251](https://github.com/jgullage65/my-website/pull/251) and [consumer #1785](https://github.com/jgullage65/JGLeadGenv1/pull/1785). The PR heads give the latest corrective commits. No replacement PR, merge, force push, production migration or manual production deployment is authorized or performed.

## Verified starting point

Fresh GitHub reads confirmed crawler head `f49399f31f8dc7ca95086676ef5271cd30d2d9f9`, main `cb325df56804bfcc742163cde65518c69f5333a9`; consumer head `9ca2c708ba22172d29a7b15e5597d765d60fa150`, main `d5d9245317380a348d625c56141e3c9eb30cb9f7`. Both remained open drafts. Local changes are compared against those actual PR trees, rather than the synthetic/private local checkout commit.

## Finding verdicts and corrections

| Finding | Verdict and actual cause | Correction |
| --- | --- | --- |
| 304 identity revalidation | Confirmed enforcement gap in reusable engine. The existing subject key hashes the exact complete request identity, so changing an address/branch normally changes the store key; ordinary cache-key collision or a production cross-business incident was not established. The reusable `previous` input and future cache/schema evolution still required an explicit guard. A 304 previously copied facts without matching. | Retain versioned identity signals extracted from the licensed source in its outcome, bound to its immutable source fingerprint. Re-run current matching, source eligibility, permissions, claim-scope and evidence ownership checks before reuse. Missing legacy identity metadata cannot justify conditional reuse: issue an ordinary full retrieval, or fail closed if a server returns unsolicited 304. Valid 304s keep immutable IDs and original retrieval dates, with a separate validation timestamp. |
| Candidate starvation | Confirmed, reproduced with four wrong first-source candidates and a useful second source. A shared four-entry `seen` set plus unreserved HTTP budgets prevented later evaluation. | Separate four discovery/evaluation candidates per adapter from eight aggregate evaluations. Preserve ten HTTP requests, byte limits, host limits and global deadline. Reserve at least one aggregate candidate slot and each selected source's minimum useful request cost; enforce a scoped request ceiling and proportional deadline. Eligible sources that cannot initially fit are explicitly deferred and may run if earlier sources leave enough resources. Never promise every eligible registry under an insufficient ten-request budget. |
| Registration versus branch | Confirmed scope-model limitation. Matching registration identifiers could return a generic confirmed match without telling consumers that location remained unproved. Existing location conflicts were already rejected; a production unsupported storefront claim was not independently established. | Matches distinguish `legal_entity` and `business_location`. Exact street/locality corroboration identifies an establishment; a registration match or phone/locality alone does not. Retain appropriately labelled legal facts when location is incomplete; reject location-specific claims under an entity-only match. Existing conflicting-address and explicit branch rejection remain conservative. GLEIF/WA facts are legal-entity scoped; Seattle account/location facts require a location match. |
| Cached policy eligibility | Confirmed bypass: active-lease/backoff reads returned a snapshot without checking current use rights. | Both cached returns and newly completed stored research pass a fresh publication-view validation: policy review/expiry/exclusion, current commercial/retention rights, adapter jurisdiction/category, identity/scope, immutable evidence and six-hour cache age. Filter ineligible facts AND their content blocks/documents/pages from new reports; recompute coverage. Historical snapshots, immutable evidence and previously published canonical Intelligence are not deleted or rewritten. |
| Website provenance | Confirmed internal misclassification, not proof of an existing user-facing source error. External coverage/confidence facts and evidence were labelled `website`; canonical research metadata already retained source kind. | Extend deterministic provenance compatibly with `public_record` and `external_source`. Public facts/evidence preserve that origin through confidence, reconciliation and API serialization. Registry authority alone earns no added confidence bonus; external nonofficial origin has its own conservative base. Existing owner/website arithmetic stays unchanged. The shared session projection can represent these origins without calling them a website. Copilot preserves origin and both identity/claim scopes; consumer filtering rejects unsupported location claims. |

### Claim and reuse boundaries

Only public-source identity is persisted in the new identity binding. The request's Place/Discovery identity is not copied into source evidence. Principal fields and registry phone values remain unretained; omitting a signal can make future reuse fail closed. Exact-input HMAC key semantics are preserved; normalization changes do not become permission to combine subjects.

A source's registered address is still labelled registered, not asserted to be an operating storefront. Headquarters/branch address conflicts remain rejected even where a legal identifier agrees, which can miss legitimate legal-only records; this conservative limitation is retained rather than relaxing existing identity rejection.

Cache reuse and a new network crawl are separate policy purposes. New retrieval still requires all six rights. A cached commercial publication requires current review/scope, content/fact retention and commercial-use rights; access/automation/extraction rights alone need not authorize a new request. Revoking commercial use, fact/content retention, excluding a source or expiring its review blocks new publication from cache. Previously granted retention and already-published canonical records are handled by their existing lifecycle. Failure to reuse evidence does not erase history or turn a successful website result into a failure.

New canonical publications carry optional `research.claimScope`, `research.match.scope`, fact/evidence provenance and, on validated 304, `research.validatedAt`. Historical canonical facts without these optional fields remain readable; newly reused crawler facts require sufficient current scope and identity metadata. Failed or unavailable source attempts are not silently promoted to fresh evidence.

## Exact code ownership

Crawler changes: `public-research/engine.ts`, `matching.ts`, `reuse.ts`, `identityKey.ts`, `coverage.ts`, `contracts.ts`, `extraction.ts`, `policy.ts`, `store.ts`, `transport.ts`, `limits.ts`, `adapters.ts`, `localRegistries.ts`; compatible provenance types/scoring in `deterministic/contracts.ts`, `confidence.ts`, `sessionAssembly.ts`, and `contracts/business.ts`. Tests: `correctiveFindings.test.ts`, `cacheStore.test.ts`, and an added shared API fixture case.

Consumer changes are limited to `researchDepth.ts` scope validation, `copilotContext.ts` preserving source/scope fields, canonical consumer regression tests, the identical shared fixture, and documentation. No discovery, matching, fetching, extraction, cache policy or reconciliation code is added to LeadForge. No database migration change is needed for these JSON-compatible fields.

The protected `crawlBusinessWebsite.ts`, website research runners, deterministic entry point, page/render/PDF budgets and existing website extraction are unchanged by this corrective work. Existing exact-content characterization checks still pass. Physical immutable evidence carriers retain their existing HTML/PDF schema; public origin is explicit on fact/evidence metadata and source policy/outcomes rather than being inferred from that legacy storage envelope.

## Tests added and executed

- Crawler supplemental/API/security suite: **90 passed**, including all previous 66 tests and 24 targeted cases. New coverage includes 304 unchanged/changed address/branch/registration, absent identity/bad fingerprint, exact subject-key separation, legal versus branch claims, expired/revoked/stale caches, concurrent active-lease readers, source failures, permission purposes, filtered content, protected website publication, four rejected candidates, duplicates, discovery exhaustion, timeouts, deadline isolation, three competing sources, actual Seattle/WA eligibility, recorded Seattle evidence, provenance/scoped API serialization and a complete owner/website-output hash captured from unchanged main.
- Existing full website crawler suite: **67 passed**. Existing immutable source, recrawl, background jobs, diagnostics, semantic extraction, HTML/sitemap/render/PDF and budget checks remain intact.
- Existing deterministic engine suite: **59 passed, 7 failed** out of 66, identically on unchanged main and this corrective work. No baseline test assertion was weakened or deleted. See the baseline section below.
- LeadForge integration/migration/concurrency/consumer suite: **11 passed**. Includes production repository SQL in isolated PGlite PostgreSQL, populated-table migration replay, canonical lease/version/downgrade preservation, plus a new public-origin/legal-scope/unsupported-branch consumer case.
- Existing LeadForge authorization/versioning/Copilot/demo checks: **21 passed**.
- Crawler production typecheck and consumer fetched-tree TypeScript check passed. Full local Next compilation and type validation passed; static page generation remains blocked by absent Clerk keys. A full local production build is not claimed.
- Producer and consumer API v1 fixtures are byte-identical. Existing website/no-website cases are preserved; an additive `scoped_official_record` case verifies fact/evidence origin and legal scope round-trip unchanged.
- No model, embedding, paid search, Places or provider dependency was added. The existing zero-call import guard and usage assertions pass. No new live-provider calls were needed for these corrective tests.

The GLEIF, Seattle and Washington adapters remain registered. Their previous adapter/security tests pass. The targeted budget test uses actual default adapter eligibility and official schema fixtures: three wrong Seattle records consume six requests, then the matching WA record receives four requests, for exactly ten total. A recorded Canlis registry sample is replayed through the real Seattle adapter. These are regression fixtures, not new live discovery-quality measurements. Previous live-evaluation rounds remain explicitly labelled historical proxy evaluations.

## Reproduced deterministic baseline failures

These seven failures reproduce on `cb325df56804bfcc742163cde65518c69f5333a9` with the same dependency tree and failure assertions. They are pre-existing extraction/topic/evidence limitations, not introduced by external provenance. Their root symptoms were inspected; their full remediation is outside the five-finding corrective scope and would alter protected website extraction.

| Existing test | Observed baseline failure |
| --- | --- |
| Structure/owner products/services | A customer-satisfaction sentence is retained although the test excludes it. |
| Multiple testimonials | Consolidated customer-proof evidence has fewer than the expected three evidence entries. |
| Multi-location realistic fixture | Extraction produces a customer segment instead of the required location/service-area fact. |
| Owner pricing same-topic conflict | Expected conflict is absent because the required extracted/topic group is not formed. |
| Repeated pricing-plan mentions | One fact remains where the assertion expects two distinct facts sharing a plan topic. |
| Supported aliases | Only one expected certification/alias fact is produced where two are asserted. |
| Sentence prefixes in plan identities | Fewer than three expected plan facts are extracted. |

These remain reported failures. No broad deterministic/extraction repair or test-expectation adjustment is smuggled into this change. They are additional acceptance limitations for the existing engine.

## Staging checks and readiness

Native script executed locally again: `api.gleif.org`, `data.seattle.gov` and `data.wa.gov` each failed closed with DNS `EAI_AGAIN`, one request and zero bytes. This is not native hosting-runtime verification. Presence checks found no Vercel token, staging database connection, database connection, research API secret or Clerk credentials. No authenticated staging checks or hosted migrations were executed.

Still required in the actual supported staging runtime: native DNS/HTTPS/CA/TLS and pinned transport/robots/API checks for all three sources; populated hosted migration lock/privilege/idempotence checks; simultaneous cross-instance requests, lease expiry and late-worker fencing; first website result before supplements and partial-failure preservation; website-only/no-website/unsuccessful discovery; Personal/Workspace access; Copilot/Pitch Deck source scope; unlock/cron refresh; seeded demo isolation. Repeat with a cached identity/policy invalidated between runs, and verify neither restricted content nor location-specific claims enter new reports.

Use the existing native script and migration/rollback procedure in `public-business-research.md`, the paired consumer integration document and PR #1785. Crawler first; additive consumer lease migration before the consumer release; authenticated smoke checks afterward. On rollback, consumer before crawler, retain additive columns/canonical versions/immutable evidence, and drain or expire jobs/leases. No security bypass or production migration is a substitute for staging acceptance.

**Assessment:** targeted fixes and local regressions are implemented; production acceptance remains blocked by unavailable authenticated staging and the documented pre-existing deterministic failures. Both original PRs must remain drafts. Preview build checks are recorded in the PRs separately from runtime acceptance; CodeRabbit skips draft review and is not an independent review approval.

## Supplemental retry and partial-failure scheduling — October 15 follow-up

### Baseline and confirmed behavior

Continued the existing draft heads: crawler `73c2c2d9f7356194437456627fae400f49546a26` and LeadForge `a6b7f306916b768581190db9de031b2c684500c9`. The six-hour unconditional gate in `runStoredPublicResearch` was confirmed by inspection and reproduced in deterministic tests, not asserted to be a production incident. Both a published partial snapshot and an exception previously set the same six-hour gate as clean research. Candidate-stage `robots_unavailable` and generic network failures also needed consistent unavailability classification. Permanent candidate HTTP failures (for example 404), identity rejection and insufficient matching evidence do not justify expedited retries.

The path is: authenticated API invokes the stored supplemental runner; the exact-identity HMAC selects a subject; one atomic insert/conflict update claims its 45-second lease only when `next_attempt_at` is due. Nonowners, including callers during backoff, read a current independently validated publication view without a network attempt. The owner runs the existing engine/adapters/transport, persists new immutable evidence, then atomically publishes the snapshot, clears its lease and writes the next eligible time and failure count. Publication and failure updates both compare the owner and unexpired lease. A fenced worker returns no publication; it cannot alter a replacement's interval, failure count or lease. Immutable/history records retain their established lifecycle.

### Exact resulting intervals

| Result | Next eligible attempt, measured from attempt completion/failure |
| --- | --- |
| Clean completed research with supported facts | 6 hours; reset consecutive failure count to zero |
| Clean completed research with no candidates or insufficient matching evidence | 6 hours; reset consecutive failure count to zero |
| First partial/unavailable or thrown attempt | 5 minutes |
| Second consecutive incomplete attempt | 15 minutes |
| Third consecutive incomplete attempt | 1 hour |
| Fourth and every subsequent consecutive incomplete attempt | 6 hours; counter saturates at four |
| Successful recovery, including a clean insufficient-evidence response | 6 hours; reset failure count so a later outage begins at 5 minutes |
| Active lease or any future eligibility time | Return validated cache, or null if none exists; do not fetch, increment counters or extend the existing deadline |

There are at most three expedited recovery intervals in an uninterrupted failure streak, followed by the normal six-hour cadence. Intervals are deterministic and persisted per subject across instances; no jitter, sleeps until the next attempt, in-request source retry loop, external job or new scheduler was introduced. DNS failures, request timeouts, HTTP 429/503, other transient HTTP failures, unavailable robots and exhausted/busy bounded source attempts use the incomplete-result path. A source can remain unavailable indefinitely without creating an increasingly aggressive loop.

The existing distributed host slots, host concurrency lease, source minimum intervals, robots decisions and fail-closed access/content permissions are unchanged. Existing global limits remain ten requests, eight aggregate candidates/four per adapter, four adapters, 25 seconds total, five seconds per request, 3 MB total bytes, 750 KB per request, two redirects and sixty supported facts. Carry-forward evidence cannot exceed the supported-fact budget.

**Eligibility is request-driven, not a promise of an automatic attempt at that time.** The crawler has no autonomous research scheduler. Inspection of the paired head's `automaticLeadIntelligence.ts` and `ensureLeadIntelligence.ts` confirmed separate canonical-product rules: completed canonical reads reuse their pack; cron freshness is 120 days for website research, seven days for limited public sources and six hours for insufficient evidence/failed rows; completed refresh and new-unlock claims also retain their 30-minute guard. Those policies can cause the next incoming crawler request to arrive later than its five-minute eligibility. This correction removes the crawler's six-hour veto when a request does arrive; it does not shorten LeadForge's product freshness policy or guarantee a five-minute cron recovery. No compatible API or consumer change is required for that behavior, and PR #1785 is unchanged. Changing canonical cron selection or adding automatic expedited invocation would be a separate product scheduling change, not an undocumented consequence of this fix.

### Evidence and failure preservation

A transiently unavailable source may contribute previously successful evidence only while the cache independently passes current identity, scope, immutable binding, source rights, policy review and six-hour freshness checks. Preserve original immutable IDs, retrieval/validation timestamps and original evidence age; never relabel a failed fetch as a successful network validation. Keep the current unavailable outcome alongside the explicitly `cached_after_source_failure` accepted observation, so a carried-forward fact cannot reset backoff. Partial retries cannot extend evidence freshness by refreshing only the snapshot timestamp. A successful actual 304 can still independently revalidate content under the established identity/policy/scope checks.

Expired or unauthorized facts and their documents/blocks/pages are excluded from new publication views on cache reads and refreshed returns; historical records remain retained under the existing lifecycle. Exceptions leave the previous stored snapshot intact and can return only its validated view while still owning the lease. Ancillary history failure after an already-fenced successful publication cannot turn that publication into a failure or change its schedule. Protected website publication/merging is unchanged. The paired canonical repository continues its established lease/version and research-depth downgrade protections; it is not modified by this task.

### Files changed in this follow-up

- `app/lib/ai-engine/public-research/scheduling.ts`: deterministic intervals, bounded failure counter and transient candidate-failure classification.
- `app/lib/ai-engine/public-research/store.ts`: persist/atomically update the counter with scheduling; fence failed-worker returns and preserve validated previous results on an owned failure.
- `app/lib/ai-engine/public-research/engine.ts`: consistent transient candidate classification, including robots unavailability.
- `app/lib/ai-engine/public-research/reuse.ts`: bounded still-valid carry-forward; per-evidence age checks in new publication views.
- `app/lib/ai-engine/public-research/schedulingStore.test.ts`: 21 focused regression cases using production store SQL in isolated PGlite PostgreSQL and fixture responses through the real engine/transport/adapters. Only persistence of immutable evidence is stubbed; claims, eligibility, counters, publication, history, failure updates and lease fencing execute actual SQL. Engine inputs are controlled to inject deterministic provider outcomes, without live requests.
- `package.json` and `package-lock.json`: development-only PGlite dependency for the SQL regression tests; runtime dependency versions unchanged.
- `docs/public-research-corrective-review.md`: this implementation/verification report.

### Verification executed and remaining blockers

- `npm run test:public-research`: **111/111 pass**, comprising the existing 90 supplemental/API/security tests and 21 added scheduling/cache/SQL cases. Covers complete/partial success; temporary DNS failure; request timeout; HTTP 429/503; robots unavailability during discovery and candidate evaluation; empty and identity-insufficient results; all bounded retry steps and reset after recovery; cached no-network reads; concurrent initial/refresh requests; populated legacy-schema upgrade and idempotence; stale successful/throwing workers; preserved valid evidence without age extension; stale/revoked/expired evidence exclusion; supported-fact limits; and ancillary history failure.
- `npm run test:ai-builder-crawler`: **67/67 pass**. Protected full website crawler files are unchanged. Existing website-first publication, failure preservation, source throttling, robots, security, global budgets and exact deterministic-output characterization also pass in the supplemental suite.
- `npm run typecheck`: pass. `git diff --check`: pass. No production build or hosted database execution is claimed for this follow-up.
- No LeadForge files, API fixture contract, AI/token/provider/Places call path or protected full website extraction were changed. No merge, deployment or production migration was performed. Both existing draft PRs remain drafts.

The store's existing idempotent startup schema workflow adds `consecutive_failures integer NOT NULL DEFAULT 0`; a populated pre-column state table was upgraded without changing its cached snapshot or eligibility. Hosted staging still must validate DDL privileges/locking and cross-instance behavior. No production database was contacted. Rollback can retain this additive column and all snapshots/evidence; old code ignores it. Mixed old/new workers remain safe under the same lease but old workers retain their former six-hour behavior until drained.

Remaining production acceptance blockers are the previously documented native hosting-runtime DNS/TLS/pinned-transport/robots checks, authenticated end-to-end and cross-instance staging verification, and hosted migration privileges/lock/idempotence validation. Existing seven deterministic-suite baseline failures remain documented above and were not repaired or rerun as part of this focused scheduling change. The retry intervals require an incoming request, as described above. Local passing tests do not satisfy those staging gates. Neither PR is production accepted or authorized to merge/deploy.
