import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { matchBusiness } from "./matching";
import {
  GLEIF_POLICY,
  policyRejection,
  robotsDecision,
  restrictedContent,
} from "./policy";
import { ResearchFetcher, RESEARCH_LIMITS } from "./transport";
import { researchPublicBusiness } from "./engine";
import { reconcileFacts, reconcileSnapshot } from "./reconciliation";
import {
  independentResearchEvents,
  mergeResearchResult,
} from "./orchestration";
import { gleifAdapter, publishedIndexAdapter } from "./adapters";
import {
  parseIdentity,
  type ResearchFact,
  type ResearchSnapshot,
} from "./contracts";
import { toLeadForgeEvent } from "../../../api/internal/leadforge/research/contract";

const identity = {
  name: "Acme Inc.",
  address: "123 Main Street",
  city: "Austin",
  state: "TX",
  country: "US",
};
const record = {
  id: "ABCDEFGHIJKLMNOPQRST",
  attributes: {
    lei: "ABCDEFGHIJKLMNOPQRST",
    entity: {
      legalName: { name: "Acme Incorporated" },
      legalAddress: {
        addressLines: ["123 Main St"],
        city: "Austin",
        region: "US-TX",
        country: "US",
        postalCode: "78701",
      },
      status: "ACTIVE",
    },
    registration: { status: "ISSUED" },
  },
};
const response = (
  body: string,
  contentType = "application/json",
  status = 200,
  extra: Record<string, string> = {},
) => ({
  status,
  ok: status === 200,
  headers: new Headers({ "content-type": contentType, ...extra }),
  body: new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(body));
      c.close();
    },
  }),
});
const fetcher = (work: (url: URL) => ReturnType<typeof response>) =>
  new ResearchFetcher(
    undefined,
    async (url) => work(url),
    async () => true,
  );
const registryFetcher = (item: unknown = record) =>
  fetcher((url) =>
    url.pathname === "/robots.txt"
      ? response("User-agent: *\nDisallow:", "text/plain")
      : response(
          JSON.stringify({
            data: url.pathname.endsWith("lei-records") ? [item] : item,
          }),
        ),
  );
const fact = (
  value = "We provide commercial plumbing services.",
  overrides: Partial<ResearchFact> = {},
): ResearchFact => ({
  category: "service",
  title: "Commercial plumbing",
  value,
  confidence: "medium",
  evidence: [
    {
      url: "https://api.gleif.org/api/v1/lei-records/ABCDEFGHIJKLMNOPQRST",
      excerpt: value,
    },
  ],
  research: {
    sourceKind: "official_record",
    independenceGroups: ["gleif"],
    retrievedAt: "2026-10-14T00:00:00Z",
    state: "supported",
    match: { classification: "confirmed", signals: ["name_and_address"] },
    policyId: GLEIF_POLICY.id,
    corroboration: "single_source",
  },
  ...overrides,
});

for (const [name, candidate, classification] of [
  [
    "exact name and address",
    { ...identity, name: "Acme LLC", address: "123 Main St" },
    "confirmed",
  ],
  ["similar name", { ...identity, name: "Acme Plumbing" }, "rejected"],
  ["same name another city", { ...identity, city: "Dallas" }, "rejected"],
  [
    "same city another address",
    { ...identity, address: "125 Main Street" },
    "rejected",
  ],
  [
    "shared chain domain",
    { name: "Acme", website: "https://acme.example" },
    "insufficient_evidence",
  ],
  [
    "missing address",
    { name: "Acme Inc.", city: "Austin", state: "TX" },
    "ambiguous",
  ],
  ["moved business", { ...identity, address: "99 West St" }, "rejected"],
  ["missing name", { ...identity, name: "" }, "insufficient_evidence"],
] as const)
  test("identity: " + name, () =>
    assert.equal(
      matchBusiness(identity, candidate).classification,
      classification,
    ),
  );
test("branches and registrations never cross identities", () => {
  assert.equal(
    matchBusiness(
      { ...identity, branch: "North" },
      { ...identity, branch: "South" },
    ).classification,
    "rejected",
  );
  assert.equal(
    matchBusiness(
      { ...identity, registrationId: "123", registrationAuthority: "TX" },
      { ...identity, registrationId: "456", registrationAuthority: "TX" },
    ).classification,
    "rejected",
  );
  assert.equal(
    matchBusiness(
      { name: "Acme", registrationId: "123", registrationAuthority: "TX" },
      { name: "Acme LLC", registrationId: "123", registrationAuthority: "TX" },
    ).classification,
    "confirmed",
  );
  assert.notEqual(
    matchBusiness({ ...identity, branch: "North" }, { ...identity })
      .classification,
    "confirmed",
  );
});
test("input is bounded and does not convert lead data into facts", () => {
  assert.equal(parseIdentity({ name: "x".repeat(500) })?.name.length, 200);
  assert.equal(parseIdentity({ name: 123 }), null);
  assert.equal(
    parseIdentity({ name: "Acme", rating: 5 })?.[
      "rating" as keyof typeof identity
    ],
    undefined,
  );
});
for (const right of Object.keys(GLEIF_POLICY.rights))
  test("permission denies missing " + right, () => {
    const policy = structuredClone(GLEIF_POLICY);
    (policy.rights as Record<string, boolean>)[right] = false;
    assert.equal(
      policyRejection(
        new URL("https://api.gleif.org/api/v1/lei-records"),
        policy,
      ),
      "insufficient_access_or_reuse_rights",
    );
  });
test("permissions reject unknown, excluded, expired, credentialed and cross-domain sources", () => {
  const url = new URL("https://api.gleif.org/api/v1/lei-records");
  assert.equal(policyRejection(url, undefined), "unknown_source_permissions");
  assert.equal(
    policyRejection(url, { ...GLEIF_POLICY, excluded: true }),
    "source_excluded",
  );
  assert.equal(
    policyRejection(url, { ...GLEIF_POLICY, expiresAt: "2020-01-01" }),
    "permission_review_expired",
  );
  for (const s of [
    "http://api.gleif.org/api/v1/lei-records",
    "https://api.gleif.org.evil.test/api/v1/lei-records",
    "https://user:password@api.gleif.org/api/v1/lei-records",
    "https://api.gleif.org/login",
  ])
    assert.ok(policyRejection(new URL(s), GLEIF_POLICY));
});
test("robots uses specific groups, wildcard paths, longest rule and allow ties", () => {
  const robots =
    "User-agent: *\nDisallow: /api\nAllow: /api/v1/lei-records\nDisallow: /api/v1/lei-records/private*\nUser-agent: BusinessResearchBot\nDisallow: /hidden\nAllow: /hidden/public\nCrawl-delay: 2";
  assert.deepEqual(
    robotsDecision(robots, new URL("https://x.test/hidden/public")),
    { allowed: true, delayMs: 2000 },
  );
  assert.equal(
    robotsDecision(robots, new URL("https://x.test/hidden/secret")).allowed,
    false,
  );
  assert.equal(
    robotsDecision(
      robots,
      new URL("https://x.test/api/v1/lei-records"),
      "OtherBot",
    ).allowed,
    true,
  );
  assert.equal(
    robotsDecision(
      robots,
      new URL("https://x.test/api/v1/lei-records/private1"),
      "OtherBot",
    ).allowed,
    false,
  );
  assert.equal(
    robotsDecision(
      "User-agent: *\nDisallow: /a\nAllow: /a",
      new URL("https://x.test/a"),
    ).allowed,
    true,
  );
});
test("noarchive, CAPTCHA, login and denial content fail closed", () => {
  assert.equal(
    restrictedContent(new Headers({ "x-robots-tag": "noarchive" }), "hello"),
    "retention_directive",
  );
  for (const body of [
    "Please verify you are human",
    "CAPTCHA",
    "Access denied",
    "Login required",
  ])
    assert.equal(restrictedContent(new Headers(), body), "access_barrier");
});
test("robots restrictions prevent the source request", async () => {
  const calls: string[] = [];
  const f = fetcher((url) => {
    calls.push(url.href);
    return response("User-agent: *\nDisallow: /api", "text/plain");
  });
  await assert.rejects(
    f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
    /robots_disallowed/,
  );
  assert.equal(calls.length, 1);
});
for (const code of [401, 403, 407, 429, 503, 500])
  test("HTTP " + code + " stops without retry", async () => {
    let calls = 0;
    const f = fetcher((url) => {
      calls++;
      return url.pathname === "/robots.txt"
        ? response("", "text/plain")
        : response("", "application/json", code);
    });
    await assert.rejects(
      f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
    );
    assert.equal(calls, 2);
  });
test("unknown robots is not permission to access", async () => {
  const f = fetcher(() => response("", "text/plain", 500));
  await assert.rejects(
    f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
    /robots_unavailable/,
  );
});
test("unsafe redirects are rejected before a second content request", async () => {
  const calls: string[] = [];
  const f = fetcher((url) => {
    calls.push(url.href);
    return url.pathname === "/robots.txt"
      ? response("", "text/plain")
      : response("", "text/html", 302, { location: "http://127.0.0.1/admin" });
  });
  await assert.rejects(
    f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
    /source_scope_rejected/,
  );
  assert.equal(calls.length, 2);
});
test("oversized content, unsupported types and duplicate requests cannot expand budgets", async () => {
  for (const [body, type, error] of [
    [
      "x".repeat(RESEARCH_LIMITS.requestBytes + 1),
      "application/json",
      "response_too_large",
    ],
    ["hello", "image/png", "unsupported_content_type"],
  ]) {
    const f = fetcher((url) =>
      url.pathname === "/robots.txt"
        ? response("", "text/plain")
        : response(body!, type!),
    );
    await assert.rejects(
      f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
      new RegExp(error!),
    );
  }
  const f = registryFetcher();
  await f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY);
  await assert.rejects(
    f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
    /duplicate_request/,
  );
});
test("cancellation ends research before requests", async () => {
  const c = new AbortController();
  c.abort();
  let calls = 0;
  const f = new ResearchFetcher(
    c.signal,
    async () => {
      calls++;
      return response("{}");
    },
    async () => true,
  );
  await assert.rejects(
    f.get(GLEIF_POLICY.origin + "/api/v1/lei-records", GLEIF_POLICY),
  );
  assert.equal(calls, 0);
});
test("real GLEIF adapter discovers records, re-fetches, matches and preserves licensed provenance with zero AI", async () => {
  const snapshot = await researchPublicBusiness(identity, {
    fetcher: registryFetcher(),
  });
  assert.equal(snapshot.outcomes[0]?.state, "accepted");
  assert.ok(snapshot.facts.length >= 3);
  assert.equal(snapshot.metrics.requests, 3);
  assert.equal(snapshot.metrics.aiCalls, 0);
  assert.equal(snapshot.metrics.inputTokens, 0);
  assert.equal(snapshot.metrics.outputTokens, 0);
  assert.equal(snapshot.metrics.paidRequests, 0);
  assert.ok(
    snapshot.facts.every(
      (f) =>
        f.research.match.classification === "confirmed" &&
        f.evidence.every((e) =>
          snapshot.blocks.some((b) => b.id === e.sourceBlockId),
        ),
    ),
  );
  assert.ok(!JSON.stringify(snapshot).includes("filter%5Bentity.legalName"));
  const contract = toLeadForgeEvent(mergeResearchResult(null, snapshot));
  assert.equal(
    (contract.businessKnowledgePack as any).research.depth,
    "limited_public_sources",
  );
  assert.equal((contract.target as any).normalizedUrl, undefined);
});
test("directory false matches do not become Intelligence", async () => {
  const other = structuredClone(record);
  other.attributes.entity.legalAddress.city = "Dallas";
  const snapshot = await researchPublicBusiness(identity, {
    fetcher: registryFetcher(other),
  });
  assert.equal(snapshot.facts.length, 0);
  assert.equal(snapshot.outcomes[0]?.match?.classification, "rejected");
  assert.equal(
    (mergeResearchResult(null, snapshot).research as any).depth,
    "insufficient_evidence",
  );
});
test("empty search yields not_found, never fabricated data", async () => {
  const f = fetcher((url) =>
    url.pathname === "/robots.txt"
      ? response("", "text/plain")
      : response('{"data":[]}'),
  );
  const snapshot = await researchPublicBusiness(identity, { fetcher: f });
  assert.equal(snapshot.facts.length, 0);
  assert.equal(snapshot.outcomes[0]?.state, "not_found");
});
test("published indexes are bounded and candidates stay under policy enforcement", async () => {
  const adapter = publishedIndexAdapter(
    "index",
    GLEIF_POLICY,
    GLEIF_POLICY.origin + "/api/v1/lei-records/index",
  );
  const candidates = await adapter.discover(
    identity,
    fetcher((url) =>
      url.pathname === "/robots.txt"
        ? response("", "text/plain")
        : response(
            '<a href="/api/v1/lei-records/1">Acme Inc.</a><a href="https://evil.test">Different</a>',
            "text/html",
          ),
    ),
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.discoveredBy, "index");
});
test("deduplication keeps original website values and rejects ambiguous and conflicting supplements", () => {
  const original = fact();
  delete (original as Partial<ResearchFact>).research;
  const baseline = structuredClone(original);
  const duplicate = fact();
  const ambiguous = fact("different", {
    research: {
      ...fact().research,
      match: { classification: "ambiguous", signals: [] },
    },
  });
  const conflict = fact("We provide residential plumbing services.");
  const result = reconcileFacts([original], [duplicate, ambiguous, conflict]);
  assert.deepEqual(result.facts, [baseline]);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(original, baseline);
});
test("copied claims never masquerade as independent corroboration", () => {
  const a = fact(),
    b = fact();
  b.research.independenceGroups = ["another"];
  b.evidence = [{ url: "https://other.test", excerpt: a.evidence[0]!.excerpt }];
  const result = reconcileFacts([], [a, b]);
  assert.equal(
    (result.facts[0] as ResearchFact).research.corroboration,
    "shared_origin",
  );
  assert.equal(result.facts[0]?.confidence, "medium");
});
test("existing reconciliation handles changes without destructive failure removals", async () => {
  const previous = await researchPublicBusiness(identity, {
    fetcher: registryFetcher(),
  });
  const current = await researchPublicBusiness(identity, {
    fetcher: fetcher(() => response("", "text/plain", 500)),
  });
  const reconciled = reconcileSnapshot(previous, current);
  assert.ok(reconciled.facts.length);
  assert.equal(
    (reconciled.reconciliation as any).removals.authoritative,
    false,
  );
  assert.ok(reconciled.facts.every((f) => f.research.state === "stale"));
});
test("website is published before supplements start and is not invalidated by their failure", async () => {
  const website = {
    type: "result",
    ok: true,
    knowledge: {
      facts: [
        {
          category: "service",
          title: "Services",
          value: "Website evidence",
          confidence: "high",
          evidence: [],
        },
      ],
    },
    pages: [],
    usage: { aiCalls: 0 },
    diagnostics: { pagesRetained: 500 },
  };
  let started = false;
  const iterator = independentResearchEvents({
    website: "https://example.com",
    identity,
    supplemental: true,
    websiteEvents: async function* () {
      yield website;
    },
    supplement: async () => {
      started = true;
      throw Error("blocked");
    },
  });
  assert.deepEqual((await iterator.next()).value, website);
  assert.equal(started, false);
  const next = (await iterator.next()).value!;
  assert.equal(started, true);
  assert.deepEqual(next.knowledge, website.knowledge);
  assert.deepEqual(next.diagnostics, website.diagnostics);
  assert.equal(next.type, "result");
});
test("inaccessible and missing websites keep distinct diagnostics", async () => {
  const snapshot = await researchPublicBusiness(identity, {
    fetcher: registryFetcher(),
  });
  assert.equal(
    (
      mergeResearchResult(null, snapshot, { code: "website_import_failed" })
        .research as any
    ).websiteStatus,
    "inaccessible",
  );
  assert.equal(
    (mergeResearchResult(null, snapshot).research as any).websiteStatus,
    "not_provided",
  );
});
test("all protected website crawler code remains identical except reusable exports", () => {
  const hashes = {
    "crawler/crawlBusinessWebsite.ts":
      "6911f5114909d946ff6812af198b51c966618c8f3daeba71f986f3426d6dd696",
    "research/leadforgeCompactResearch.ts":
      "73cf286f532c8baecac839dcb1ed02bb9d0adfdb14dbf1f51d7b896719a82e1f",
    "research/businessKnowledgePack.ts":
      "1d1ca194df4aed3eaaec6801ea66402d99e8d69913a3d2504e7ea1fa339c7f17",
    "deterministic/index.ts":
      "eb1e6cbaf309650c3f826ff2307e21f85e59362b79e83b5f115bbe534c229bb4",
  };
  for (const [path, hash] of Object.entries(hashes)) {
    let current = readFileSync("app/lib/ai-engine/" + path, "utf8");
    if (path === "crawler/crawlBusinessWebsite.ts")
      current = current.replace(
        /export (async )?function (requestSafeDestination|parsePdf|semanticHtml|extractJsonLd)/g,
        (_, async, name) => (async ?? "") + "function " + name,
      );
    assert.equal(
      createHash("sha256").update(current).digest("hex"),
      hash,
      path,
    );
  }
});
test("supplemental module import graph excludes model calls and paid providers", () => {
  for (const filename of readdirSync(
    "app/lib/ai-engine/public-research",
  ).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    const source = readFileSync(
      "app/lib/ai-engine/public-research/" + filename,
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /from\s+["'][^"']*(?:openai|models|embedding|googlePlaces|knowledge\/extract|businessKnowledgePack)/i,
      filename,
    );
    assert.doesNotMatch(
      source,
      /(?:chat\.completions|responses\.create|embeddings\.create|places\.googleapis|serpapi|firecrawl)/i,
      filename,
    );
  }
});

test("producer matches the shared legacy and no-website API fixtures exactly", () => {
  const fixture = JSON.parse(
    readFileSync("test/fixtures/research-api-v1.json", "utf8"),
  );
  for (const example of fixture.cases)
    assert.deepEqual(
      JSON.parse(JSON.stringify(toLeadForgeEvent(example.raw, "fixture-lead"))),
      example.event,
      example.name,
    );
});

test("approved single-business HTML reuses semantic and JSON-LD evidence extraction", async () => {
  const policy = {
    ...GLEIF_POLICY,
    id: "test-directory",
    authority: "directory" as const,
    origin: "https://directory.test",
    paths: ["/business"],
    independenceGroup: "test-directory",
  };
  const url = policy.origin + "/business/acme";
  const html =
    '<html><main><h1>Acme Inc. Services</h1><p>We provide commercial plumbing services for business customers.</p><p>Our company specializes in commercial maintenance.</p></main><script type="application/ld+json">' +
    JSON.stringify({
      "@type": "LocalBusiness",
      name: "Acme Inc.",
      address: {
        streetAddress: "123 Main St",
        addressLocality: "Austin",
        addressRegion: "TX",
        addressCountry: "US",
      },
    }) +
    "</script></html>";
  const adapter = {
    id: "test-published-index",
    policy,
    discover: async () => [
      {
        url,
        policyId: policy.id,
        discoveredBy: "test-published-index",
        discoveredFrom: policy.origin + "/business",
      },
    ],
  };
  const snapshot = await researchPublicBusiness(identity, {
    adapters: [adapter],
    fetcher: fetcher((u) =>
      u.pathname === "/robots.txt"
        ? response("", "text/plain")
        : response(html, "text/html"),
    ),
  });
  assert.equal(snapshot.outcomes[0]?.state, "accepted");
  assert.ok(snapshot.blocks.some((b) => b.extractionMethod === "json_ld"));
  assert.ok(
    snapshot.blocks.some((b) => b.extractionMethod === "semantic_html"),
  );
  assert.ok(snapshot.facts.length);
  assert.ok(snapshot.facts.every((f) => f.confidence !== "high"));
});
test("multi-business documents do not contaminate one business Intelligence", async () => {
  const policy = {
    ...GLEIF_POLICY,
    id: "test-directory",
    origin: "https://directory.test",
    paths: ["/business"],
  };
  const url = policy.origin + "/business/acme";
  const business = {
    "@type": "LocalBusiness",
    name: "Acme Inc.",
    address: {
      streetAddress: "123 Main St",
      addressLocality: "Austin",
      addressRegion: "TX",
    },
  };
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify([business, { ...business, name: "Other Company" }]) +
    "</script>";
  const snapshot = await researchPublicBusiness(identity, {
    adapters: [
      {
        id: "test",
        policy,
        discover: async () => [
          {
            url,
            policyId: policy.id,
            discoveredBy: "test",
            discoveredFrom: url,
          },
        ],
      },
    ],
    fetcher: fetcher((u) =>
      u.pathname === "/robots.txt"
        ? response("", "text/plain")
        : response(html, "text/html"),
    ),
  });
  assert.equal(snapshot.facts.length, 0);
  assert.equal(snapshot.outcomes[0]?.reason, "identity_multiple_entities");
});
test("conditional requests retain immutable evidence without charging another body download", async () => {
  const previous = await researchPublicBusiness(identity, {
    fetcher: registryFetcher(),
  });
  previous.outcomes[0]!.etag = '"fixture"';
  let conditional = false;
  const wire = async (url: URL, options: any) => {
    if (url.pathname === "/robots.txt") return response("", "text/plain");
    if (url.pathname.endsWith("lei-records"))
      return response(JSON.stringify({ data: [record] }));
    conditional = options.headers["if-none-match"] === '"fixture"';
    return response("", "application/json", 304);
  };
  const current = await researchPublicBusiness(identity, {
    previous,
    fetcher: new ResearchFetcher(undefined, wire, async () => true),
  });
  assert.equal(conditional, true);
  assert.equal(current.documents[0]?.id, previous.documents[0]?.id);
  assert.equal(current.facts.length, previous.facts.length);
  assert.equal(current.outcomes[0]?.reason, "not_modified");
});
test("source records disagreeing on the same business topic remain reviewable conflicts", () => {
  const a = fact(),
    b = fact("A different commercial plumbing offer.");
  const result = reconcileFacts([], [a, b]);
  assert.equal(result.facts.length, 0);
  assert.equal(result.conflicts.length, 2);
});
test("content directives are enforced regardless of HTML attribute order", () => {
  assert.equal(
    restrictedContent(
      new Headers(),
      '<meta content="noarchive" name="robots">',
    ),
    "retention_directive",
  );
  assert.equal(
    restrictedContent(new Headers(), '<input type="password">'),
    "access_barrier",
  );
});

test("an aborted body is cancelled instead of hanging a supplemental job", async () => {
  const cancellation = new AbortController();
  let cancelled = false;
  const f = new ResearchFetcher(
    cancellation.signal,
    async (url) => {
      if (url.pathname === "/robots.txt") return response("", "text/plain");
      return {
        status: 200,
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        body: new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      };
    },
    async () => true,
  );
  const pending = f.get(
    GLEIF_POLICY.origin + "/api/v1/lei-records",
    GLEIF_POLICY,
  );
  setTimeout(() => cancellation.abort(), 10);
  await assert.rejects(pending);
  assert.equal(cancelled, true);
});
