# Deterministic public business research

Baseline: `cb325df56804bfcc742163cde65518c69f5333a9` (`main`, October 14, 2026 inspection).

## Ownership and protected behavior

`my-website` owns the supplemental engine in `app/lib/ai-engine/public-research/`. LeadForge supplies transient identity and consumes the authenticated research API. There is no shared database connection or LeadForge implementation of discovery, matching, crawling or reconciliation.

The full website crawler, AI Builder research runner and deterministic website runner remain unchanged in behavior. Four existing safe/pure functions are exported for reuse; no limits or internal statements were changed. Portable SHA-256 characterization checks protect those functions and both research runners. Existing crawling covers internal links, priority paths, sitemaps, rendered HTML, PDFs, JSON-LD, semantic normalization, source records and deterministic knowledge. Website budgets remain 500 pages, 100 sitemap requests, concurrency 3, HTML 750,000 bytes, PDFs 3/10MiB/75 pages, rendered pages 3 with a 12-second total rendering budget.

AI Builder's `businessKnowledgePack` still performs its established model-backed extraction and reconciliation. LeadForge's `leadforgeCompactResearch` remains deterministic and unchanged. Existing AI Builder jobs are authenticated imports bound to a Clerk user and a website; they are not repurposed to run cross-business public API discovery. Supplemental work uses the existing API request lifetime and existing LeadForge cron/unlock scheduling. It creates no second scheduler.

## Actual source coverage and permissions

The enabled discovery adapter queries the free GLEIF LEI API and independently retrieves individual records. Coverage is limited to entities in that registry. It provides registered legal name, registered legal address, legal entity status and LEI registration status. A LEI is not a professional license, evidence of an active storefront, or an operating service area. Name alone, name plus a chain domain, and city alone cannot confirm a record. Exact normalized name plus a branch-specific street address and city/region, or an appropriate matching registration authority/identifier, is required. Ambiguous sources remain rejected.

Permission records separately authorize access, automated retrieval, extraction, content retention, fact retention and commercial reuse. Unknown rights, missing rights, excluded sources and expired reviews fail closed. The approved record covers GLEIF API data, not its website prose, logos, linked sources, or third-party directories. The review expires April 14, 2027 and must be renewed against the then-current primary policies.

Primary permission evidence, checked October 14, 2026:

- https://www.gleif.org/en/about/open-data — published CC0 data policy.
- https://www.gleif.org/en/lei-data/gleif-api — supported public LEI search API.
- https://api.gleif.org/robots.txt — checked at runtime; missing 404 robots is distinguished from unavailable/denied robots.

The generic published-index adapter supports bounded approved HTML indexes and sitemaps. It is reusable code, not a claim that any additional directory is currently authorized. Additional adapters/policies require verified access and reuse rights before registration. Approved individually retrieved HTML reuses semantic extraction, JSON-LD and the existing deterministic engine. Approved PDFs reuse the existing parser; they need explicit business identity fields to pass matching. JS-only external sources are currently excluded; the original website rendering path is unchanged. Wikidata search/API paths are excluded because its checked robots file disallows them. Google Search/Maps scraping, new Places requests, paid enrichment, proxy services and archives are not used. No directory coverage, licensing coverage, archive availability or historical corroboration is fabricated.

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

- `npm run test:public-research`: 57 passing API, safety, matching, extraction, provenance, conditional-request and isolation checks.
- `npm run typecheck`: passes.
- Existing business-memory/provenance contracts with `--experimental-transform-types`: 28 pass. The older strip-only npm script cannot parse its existing TypeScript parameter property.
- Existing crawler regression suite: 62/67 pass; five sitemap/PDF fixture failures reproduce on the untouched baseline. Baseline before dependency installation additionally reported two missing-package failures. No protected crawler code was changed to conceal them.
- Live robots and LEI search GETs succeeded through this environment's HTTP proxy. The native production transport fails closed here with DNS `EAI_AGAIN`; a deployed-service native-transport smoke test is required.

Review and deploy the crawler first, then the paired LeadForge integration with its research-lease migration. Run the native GLEIF lookup, website-only fixture, successful website + denied supplement, no-website insufficient/confirmed cases and canonical authorization checks on staging. No production deployment or `main` mutation was performed by this change.
