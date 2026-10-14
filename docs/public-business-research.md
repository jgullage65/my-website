# Deterministic public business research

Baseline: `cb325df56804bfcc742163cde65518c69f5333a9` (`main`, October 14, 2026 inspection).

## Ownership and protected behavior

`my-website` owns the supplemental engine in `app/lib/ai-engine/public-research/`. LeadForge supplies transient identity and consumes the authenticated research API. There is no shared database connection or LeadForge implementation of discovery, matching, crawling or reconciliation.

The full website crawler, AI Builder research runner and deterministic website runner remain unchanged in behavior. Four existing safe/pure functions are exported for reuse; no limits or internal statements were changed. Portable SHA-256 characterization checks protect those functions and both research runners. Existing crawling covers internal links, priority paths, sitemaps, rendered HTML, PDFs, JSON-LD, semantic normalization, source records and deterministic knowledge. Website budgets remain 500 pages, 100 sitemap requests, concurrency 3, HTML 750,000 bytes, PDFs 3/10MiB/75 pages, rendered pages 3 with a 12-second total rendering budget.

AI Builder's `businessKnowledgePack` still performs its established model-backed extraction and reconciliation. LeadForge's `leadforgeCompactResearch` remains deterministic and unchanged. Existing AI Builder jobs are authenticated imports bound to a Clerk user and a website; they are not repurposed to run cross-business public API discovery. Supplemental work uses the existing API request lifetime and existing LeadForge cron/unlock scheduling. It creates no second scheduler.

## Actual source coverage and permissions

The GLEIF discovery adapter queries the free GLEIF LEI API (the two additional enabled local registries are documented below) and independently retrieves individual records. Coverage is limited to entities in that registry. It provides registered legal name, registered legal address, legal entity status and LEI registration status. A LEI is not a professional license, evidence of an active storefront, or an operating service area. Name alone, name plus a chain domain, and city alone cannot confirm a record. Exact normalized name plus a branch-specific street address and city/region, or an appropriate matching registration authority/identifier, is required. Ambiguous sources remain rejected.

Permission records separately authorize access, automated retrieval, extraction, content retention, fact retention and commercial reuse. Unknown rights, missing rights, excluded sources and expired reviews fail closed. The approved record covers GLEIF API data, not its website prose, logos, linked sources, or third-party directories. The review expires April 14, 2027 and must be renewed against the then-current primary policies.

Primary permission evidence, checked October 14, 2026:

- https://www.gleif.org/en/about/open-data — published CC0 data policy.
- https://www.gleif.org/en/lei-data/gleif-api — supported public LEI search API.
- https://api.gleif.org/robots.txt — checked at runtime; missing 404 robots is distinguished from unavailable/denied robots.

The generic published-index adapter supports bounded approved HTML indexes and sitemaps. It is reusable code, not a claim that any additional directory is currently authorized. Additional adapters/policies require verified access and reuse rights before registration. Approved individually retrieved HTML reuses semantic extraction, JSON-LD and the existing deterministic engine. Approved PDFs reuse the existing parser; they need explicit business identity fields to pass matching. JS-only external sources are currently excluded; the original website rendering path is unchanged. Wikidata search/API paths are excluded because its checked robots file disallows them. Google Search/Maps scraping, new Places requests, paid enrichment, proxy services and archives are not used. No unconfigured directory coverage, archive availability or historical corroboration is claimed.

## Safety, budgets and diagnostics

Supplemental budgets: 10 requests including robots/redirects; 4 candidates per adapter; at most 4 registered adapters; 7 requests per host; 750,000 bytes per response; 3MB total response bytes; 25 seconds network research; 5 seconds per request; 2 redirects; 60 facts. Each source is policy-checked before retrieval and on every redirect. The existing DNS/IP validator and pinned HTTP transport prevent rebinding and SSRF. No cookies, authentication, credentials, proxy subscriptions or access bypasses are used. Robots groups/path precedence, crawl delay, content retention directives, access denials, CAPTCHA, oversized responses and unsupported content types produce auditable rejection reasons. Transient and rate-limit failures back off rather than retrying immediately.

Database host slots last at least six seconds (longer than the five-second request deadline) and fence concurrent processes. Subject leases last 45 seconds, with compare-and-set publication; another worker cannot overwrite the lease holder. Cached rejection/empty snapshots back off for six hours. Schema creation follows the service's existing lazy, idempotent persistence convention. A writable crawler database is required; its failure never invalidates a published website result.

Each snapshot records actual requests, bytes, elapsed time, accepted/rejected outcomes and zero AI/input/output/paid-request counters. Input identity is held only for matching; its state key is an HMAC using `PUBLIC_RESEARCH_IDENTITY_HASH_SECRET` (or the existing internal API secret). Original Discovery fields and Google response payloads are not copied into research evidence. Search query identity is omitted from persisted discovery URLs.

## Evidence and change tracking

Accepted source documents/blocks use existing immutable source IDs, hashes, coordinates and persistence. Public snapshots/history belong to the crawler, not a competing LeadForge Intelligence store. Conditional ETag/Last-Modified requests preserve original immutable records on 304. Existing recrawl reconciliation and extraction-planning functions produce added/changed/unchanged/removed observations, stale evidence and fingerprints. Removals are never authoritative merely because public discovery or a source fails. Failed previous evidence is retained as stale and excluded from new sales assertions. Previously published canonical research remains available when a replacement is weaker.

Website facts retain their values and confidence. Supplements add only confirmed, evidenced, useful facts. Exact duplicates are skipped. Independent-group corroboration requires different evidence excerpts; copied claims never count as independent proof. Adapter priority uses missing categories, authority, prior observed yield and prior source failures; all adapters share the candidate/request/byte budgets. Coverage reuses the existing deterministic confidence/coverage functions on accepted facts, while website coverage remains unchanged. New conflicting claims remain in reviewable source facts/diagnostics and do not enter sales facts. Confidence describes deterministic evidence strength, not certainty of truth. Human-correction machinery remains intact; supplements do not rewrite website or owner assertions.

## Compatible research API

Existing website-only requests use the original runner and contract. Optional additions:

```json
{
  "website": "https://business.example",
  "externalReference": "existing-lead-id",
  "businessIdentity": {"name": "Business", "address": "123 Main St", "city": "Austin", "state": "TX"},
  "supplemental": true
}
```

Omit `website` to request public-source-only research with a valid identity. Existing result fields retain their meanings. `businessKnowledgePack.research` adds depth, website status/failure, source outcomes, source facts, conflicts, supplemental pages and metrics. `crawl.pages` remains website pages; supplemental pages are separate. Depth is `full_website`, `website_with_supplements`, `limited_public_sources`, or `insufficient_evidence`. Existing lead facts remain transient context rather than being relabeled researched evidence.

Streaming expanded requests emit the complete website result immediately, before supplemental work starts, and may subsequently emit an enriched `result`. Clients must commit the first result on receipt and continue reading; a subsequent failure does not revoke it. Legacy clients still receive their unchanged stream when they omit the new options. For a website-bearing non-streaming request, supplements are not started: the original website result returns immediately. Website supplementation requires streaming (LeadForge already uses it). No detached serverless background work is launched. No-website non-streaming requests can return public-source results. Shared fixtures in `test/fixtures/research-api-v1.json` are identical to LeadForge's consumer fixtures.

## Verification and rollout

- `npm run test:public-research`: 66 passing API, safety, matching, extraction, provenance, conditional-request and isolation checks.
- `npm run typecheck`: passes.
- Existing business-memory/provenance contracts with `--experimental-transform-types`: 28 pass. The older strip-only npm script cannot parse its existing TypeScript parameter property.
- Existing crawler regression suite: 67/67 pass on the PR and on unchanged baseline production code with corrected regression fixtures. The five initial failures are individually explained below. No protected crawler implementation was changed.
- Live robots and LEI search GETs succeeded through this environment's HTTP proxy. The native production transport fails closed here with DNS `EAI_AGAIN`; a deployed-service native-transport smoke test is required.

Review and deploy the crawler first, then the paired LeadForge integration with its research-lease migration. Run the native GLEIF lookup, website-only fixture, successful website + denied supplement, no-website insufficient/confirmed cases and canonical authorization checks on staging. No production deployment or `main` mutation was performed by this change.

## Follow-up: enabled local registries and measured coverage

The default adapter list now also includes these two reviewed sources. These are narrow, functional jurisdictions, not nationwide local-business discovery.

| Source | Eligible scope | Access and reuse | Retained facts |
| --- | --- | --- | --- |
| Seattle Active Business License Tax Certificate, dataset `wnbq-64tb` | Seattle, WA identities, all published industries | Official dataset metadata declares `PUBLIC_DOMAIN`; anonymous Socrata GET API; robots permits resource and metadata paths with 1s crawl delay | Published legal/trade names, registered address, industry classification, tax-certificate account, start date and explicitly qualified active-dataset inclusion |
| Washington L&I Contractor License Data – General, dataset `m8qx-ubtq` | Washington identities with contractor/construction/trade categories | Official metadata declares `PDDL`; anonymous Socrata GET API; robots permits resource and metadata paths with 1s crawl delay. PDDL permits commercial reuse and database/content retention | Registered business/address, contractor license number, published status/expiration and specialties |
| GLEIF LEI API | Legal entities present in GLEIF, worldwide where identity confirms | Existing CC0 permission record, API and runtime robots checks | Legal entity identification/status, not storefront or professional licensing claims |

Primary permission and API references:
- https://data.seattle.gov/api/views/wnbq-64tb.json (publisher: Seattle Finance and Administrative Services; license ID `PUBLIC_DOMAIN`)
- https://data.wa.gov/api/views/m8qx-ubtq.json (publisher: Washington Labor & Industries; license ID `PDDL`)
- https://opendatacommons.org/licenses/pddl/1-0/ (commercial use and reuse; no mandatory attribution under PDDL)
- https://dev.socrata.com/docs/app-tokens.html (anonymous requests supported with throttling; no paid token/provider)
- https://data.seattle.gov/robots.txt and https://data.wa.gov/robots.txt

Both local adapters fetch live dataset metadata before searching and fail closed if the dataset ID or license changes. The six access/extraction/retention/commercial rights remain separate enforced policy fields. Policies expire April 14, 2027. Source scope includes only these resource/metadata endpoints. Runtime robots, rate limits, access restrictions and retention directives can further deny access. Publisher attribution is retained in an evidenced fact. No principal-name fields or telephone values are retained from these datasets. Public business names and registered addresses can include sole proprietors; no claim is made that registration is an operating storefront. Linked sites and other portal datasets are not authorized by these records.

Queries use exact published legal or DBA names, city and available ZIP, bounded to four ordered candidates. SoQL string literals are escaped. Each candidate is independently retrieved by its published account/license key; mismatched keys and nonunique responses are rejected. DBA aliases are accepted only when published in that record; location conflicts still reject even with a matching legal identifier. Washington state-name/abbreviation and US ZIP+4 normalization are supported. Fuzzy DBA spelling, inferred moves, alias guessing and chain-domain-only matching are deliberately excluded. Out-of-jurisdiction/category sources report `not_researched`, not an invented search result. Local sources take priority over the broader LEI source when applicable.

`test/fixtures/local-registry-live-evaluation.json` records seven controlled live API evaluations via this environment's HTTPS proxy: Canlis (restaurant), Ebony Designs (salon), Safeway Store 1508 (retail), Helsell Fetterman (professional services), Manson Construction, Eco Star C G Construction (WA contractor), and Brown Bear Car Wash (automotive care). The initial seven retrievals produced supported registry facts: 55 total, four requests each, zero AI/token/paid-provider usage; each run remained within 25s. A final repeat with city/ZIP discovery filters produced findings for five of seven (39 facts, 23 requests total). Manson Construction timed out during metadata retrieval and Brown Bear during robots retrieval; both returned `source_unavailable` with zero new facts, at 7.782s and 5.004s respectively. Successful repeat runs took 12.797–16.429s. Both rounds and the earlier wrong-branch rejection are preserved in the evaluation fixture; no failed request is counted as business evidence. This sample was selected from known registry rows and uses their registered identity as input. It demonstrates adapter functionality, not precision/recall on unseen leads, independent verification of registry truth, broad business coverage, website enrichment yield, or production network acceptance. It contains no website-crawl evaluation. The automotive sample is a car wash, not proof of repair-shop coverage. An initial unfiltered automotive chain query returned four different branches, all rejected with zero accepted facts; adding city/ZIP discovery constraints then retrieved and confirmed the intended branch. Discovery remains capped and can miss a correct branch.

## Five baseline crawler failures: disposition

The original suite failed identically on baseline `cb325df56804bfcc742163cde65518c69f5333a9` and the initial PR. Only test fixtures/assertions changed; the production crawler retains the same four reusable exports and otherwise remains identical.

| Failing test | Root cause and corrected characterization |
| --- | --- |
| Standard sitemap URL set | Assertions denied the sitemap behavior named by the test. Baseline fetches same-host `/locations` and normalized `www` `/team`, excludes other hosts/PDF HTML processing; discovers 14 URLs, not 13. |
| Durable HTML/sitemap pages | Every fixture body was identical, so deduplication correctly discarded pages the assertion required retaining. Fixtures now have distinct paragraph evidence and assert retention for both discovery paths. Baseline also accepts singular `/category/seo` because the editorial regex covers `categories` but not `category`; this pre-existing filtering limitation is explicitly characterized, not silently fixed. |
| Sitemap index | Assertion incorrectly denied fetching `/case-studies` from the nested sitemap. The corrected assertion requires that existing behavior; malformed sitemap fallback checks remain. |
| Large sitemap priority | Assertions assumed a 12-page limit. Existing production budget is 500: 12 priority paths first, then 488 sitemap paths; 1012 discovered, 499 exact duplicate bodies skipped. Corrected checks enforce that full behavior. |
| Durable PDF independent cap | The assertion prohibited all `.pdf` URLs in HTML retrieval, while baseline can enqueue non-durable PDFs as HTML. Eligible durable PDFs remain in the separate three-document path; DOCX is excluded, and unsupported fixtures are not retained. The corrected assertions characterize this existing limitation and preserve all PDF budget/evidence checks. |

The corrected suite passes all 67 tests on both baseline production code and the PR code. These tests are compatibility evidence, not a claim that the pre-existing category/PDF filtering limitations were repaired.

## Additional operational controls

Host concurrency now uses an owner-fenced six-second lease (the request deadline is five seconds), released in a `finally` block independently of the minimum request interval. This allows successive completed requests after the actual crawl delay instead of reserving six seconds per request. Failed workers recover through lease expiry; late release cannot unlock a newer owner. In-memory test/local slots also hold an in-flight lock. Denied slots are bounded; 429/503 responses never cause an immediate retry. Per-subject successful/failed attempts back off six hours. Source retrieval timeout/transport failures are distinguished from identity rejection and make attempts partial.

A serialized public snapshot is capped at 1,000,000 bytes before evidence writes. Redundant public snapshot history retains the newest 32 per subject; current state remains separately available. Existing immutable source records are not deleted because canonical versions can reference them. Their growth remains bounded per attempt and by the six-hour subject backoff, not globally finite; operators must measure table growth under the existing evidence-retention lifecycle. Monitor request/byte/duration metrics, outcomes, `pg_total_relation_size` for the three public-research tables and existing immutable evidence tables, and `pg_column_size(snapshot)` grouped by subject. No unreviewed global evidence purge is introduced.

## Native staging gate and rollout

`scripts/verify-public-research-network.ts` exercises runtime robots and permitted JSON reads through the unchanged native DNS-validated, IP-pinned transport for all three enabled hosts. It must run **inside the actual staging deployment runtime**, using normal CA/TLS verification and no proxy substitute:

```sh
node --experimental-transform-types --experimental-loader ./test/node-alias-loader.mjs scripts/verify-public-research-network.ts
```

This environment's native run failed with `getaddrinfo EAI_AGAIN` for `api.gleif.org`, `data.seattle.gov` and `data.wa.gov`; no native body was fetched. Proxy evaluations succeeded and are explicitly not a substitute. Authenticated staging execution and database access are unavailable through the current connection. Deployment DNS/TLS behavior, database privileges/schema creation, lease expiry across real service instances, stream timing through the production proxy and production-scale storage remain unverified. Production acceptance is blocked on those gates.

For staging: run the native harness and existing SSRF/redirect/robots tests; then authenticated website-only, streaming website-plus-supplement, denied/timed-out supplement, inaccessible-site fallback and no-website confirmed/ambiguous/empty requests. Confirm the first website result reaches LeadForge before supplemental work, with original website facts/budgets unchanged; inspect persisted immutable IDs and usage (zero extra model/paid calls). Run the paired LeadForge populated-database migration and concurrency checklist in its integration document. Use staging credentials from the deployment secret manager, never inline or log them. Do not expose a public diagnostic route or disable safety to get a green test.

Keep PR #251 and PR #1785 draft until these gates pass. After review/authorization, deploy the backward-compatible crawler first, apply the additive LeadForge lease migration, then deploy its consumer. Roll back the consumer to its previous release first, then the crawler if needed. Keep the additive nullable lease columns and immutable evidence/version rows during rollback; stop research jobs and let leases expire before resuming older workers. Requests omitting supplemental settings retain website-only behavior. No main reset, force push, merge, production migration or manual deployment is part of this follow-up.
