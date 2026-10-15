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
