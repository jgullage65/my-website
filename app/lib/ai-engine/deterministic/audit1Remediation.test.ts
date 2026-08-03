import assert from "node:assert/strict";
import test from "node:test";
import { classifyPage, normalizeSources } from "./index";
import { extractOwnerFacts, extractWebsiteFacts } from "./extraction";
import type { DeterministicEngineInput } from "./contracts";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "../crawler/websiteSourceRecords";

const doc = (id: string, url: string): WebsiteSourceDocumentRecord => ({ schemaVersion: 1, id, crawlAttemptId: "attempt", actualFetchedUrl: url, canonicalUrl: url, redirectChain: [], sourceType: "html", contentType: "text/html", status: "retained", fetchedAt: "2026-08-03T00:00:00Z", sourceContentHash: "a".repeat(64), extractedContentHash: "b".repeat(64), language: "en", sourceTruncated: false, extractionTruncated: false, discoveryMethod: "submitted", discoveredFromUrl: null });
const block = (id: string, sourceDocumentId: string, type: WebsiteSourceBlockRecord["type"], normalizedText: string): WebsiteSourceBlockRecord => ({ schemaVersion: 1, id, sourceDocumentId, crawlAttemptId: "attempt", type, normalizedText, coordinates: { lineStart: 1, lineEnd: 1 }, extractionMethod: "semantic_html" });
function website(type: string, texts: string[], heading = "Details") {
  const input: DeterministicEngineInput = { pages: [{ url: `https://example.test/${type}`, pageType: type, title: heading, sourceDocumentId: "d" }], sourceDocuments: [doc("d", `https://example.test/${type}`)], sourceBlocks: [block("h", "d", "heading", heading), ...texts.map((text, i) => block(`b${i}`, "d", "paragraph", text))] };
  return extractWebsiteFacts(normalizeSources(input));
}

test("owner industry is explicit, provenance-preserving, empty-safe, and stable", () => {
  const facts = extractOwnerFacts({ owner: { industry: " Healthcare " } });
  assert.equal(facts.length, 1); assert.equal(facts[0].category, "industry_served");
  assert.equal(facts[0].provenance, "owner"); assert.equal(facts[0].evidence[0].excerpt, "Healthcare");
  assert.equal(facts[0].topicKey, extractOwnerFacts({ owner: { industry: "Healthcare" } })[0].topicKey);
  assert.equal(extractOwnerFacts({ owner: { industry: "  " } }).length, 0);
});

test("owner products and services split only when both concepts are explicit", () => {
  const mixed = extractOwnerFacts({ owner: { productsServices: "We provide LeadForge software and implementation services." } });
  assert.deepEqual(mixed.map(f => f.category).sort(), ["product", "service"]);
  assert.equal(new Set(mixed.map(f => f.topicKey)).size, 2); assert.ok(mixed.every(f => f.evidence[0].excerpt === "We provide LeadForge software and implementation services."));
  assert.deepEqual(extractOwnerFacts({ owner: { productsServices: "LeadForge software platform." } }).map(f => f.category), ["product"]);
  assert.deepEqual(extractOwnerFacts({ owner: { productsServices: "We provide implementation consulting." } }).map(f => f.category), ["service"]);
  assert.equal(extractOwnerFacts({ owner: { productsServices: "Our software and service approach is flexible." } }).length, 1);
  assert.deepEqual(mixed, extractOwnerFacts({ owner: { productsServices: "We provide LeadForge software and implementation services." } }));
});

test("explicit website lists expand conservatively with original evidence", () => {
  const cases: Array<[string, string, string, string[]]> = [
    ["security", "Our platform is SOC 2 and HIPAA compliant.", "security_compliance", ["security_compliance:soc2", "security_compliance:hipaa"]],
    ["integrations", "We integrate with HubSpot and Salesforce.", "integration", ["integration:hubspot", "integration:salesforce"]],
    ["pricing", "The Starter plan costs $20 and the Pro plan costs $40.", "pricing_plan", ["pricing_plan:starter", "pricing_plan:pro"]],
    ["services", "We offer strategy consulting and implementation services.", "service", ["service:strategy_consulting", "service:implementation"]],
    ["products", "Our products include Atlas software and Beacon app.", "product", ["product:atlas", "product:beacon"]],
    ["locations", "Our offices are located in Atlanta and Denver.", "location_service_area", ["location:atlanta", "location:denver"]],
  ];
  for (const [type, sentence, category, topics] of cases) {
    const facts = website(type, [sentence]).filter(f => f.category === category);
    assert.deepEqual(facts.map(f => f.topicKey).sort(), topics.sort(), sentence);
    assert.ok(facts.every(f => f.evidence[0].excerpt === sentence));
  }
  assert.ok(website("products", ["Our favorites include speed and quality."]).filter(f => f.category === "product").length <= 1);
});

test("security identities always agree with their category and never collide with certifications", () => {
  for (const claim of ["Data uses encryption.", "We support SSO.", "We require MFA.", "We are SOC 2 compliant.", "We are HIPAA compliant.", "We are ISO 27001 compliant."]) {
    const fact = website("security", [claim], "Security").find(f => f.category === "security_compliance");
    assert.ok(fact); assert.ok(fact.topicKey.startsWith("security_compliance:"));
  }
  const certification = website("certifications", ["We are Green Business certified."], "Certifications").find(f => f.category === "certification");
  assert.ok(certification?.topicKey.startsWith("certification:"));
  assert.notEqual(certification?.topicKey, website("security", ["We are SOC 2 compliant."])[0]?.topicKey);
});

test("recognized declarations are authoritative while unusable declarations fall back", () => {
  assert.equal(classifyPage({ url: "/faq", pageType: "faq", title: "Pricing FAQ" }), "faq");
  assert.equal(classifyPage({ url: "/services", pageType: "services", headings: ["Pricing"] }), "services");
  assert.equal(classifyPage({ url: "/anything", pageType: "pricing" }), "pricing");
  assert.equal(classifyPage({ url: "/pricing", title: "Plans" }), "pricing");
  assert.equal(classifyPage({ url: "%%%", title: "Support" }), "support");
  assert.equal(classifyPage({ url: "/integrations", pageType: "mystery" }), "integrations");
});

test("normalization adjacency and fallback remain document-local", () => {
  const input: DeterministicEngineInput = { pages: [{ url: "https://x.test/a", pageType: "services", text: "We provide strategy consulting.", sourceDocumentId: "a" }, { url: "https://x.test/b", pageType: "products", text: "Our Atlas software platform helps teams.", sourceDocumentId: "b" }], sourceDocuments: [doc("a", "https://x.test/a"), doc("b", "https://x.test/b")], sourceBlocks: [block("a-heading", "a", "heading", "Services"), block("a-chrome", "a", "paragraph", "Learn more"), block("b-chrome", "b", "paragraph", "Accept cookies")] };
  const normalized = normalizeSources(input);
  const aLast = normalized.filter(x => x.evidence.sourceDocumentId === "a").at(-1)!;
  const bFirst = normalized.find(x => x.evidence.sourceDocumentId === "b")!;
  assert.equal(aLast.nextBlockId, undefined); assert.equal(bFirst.previousBlockId, undefined);
  assert.ok(normalized.some(x => x.type === "page_text" && x.evidence.sourceDocumentId === "a"));
  assert.ok(normalized.some(x => x.type === "page_text" && x.evidence.sourceDocumentId === "b"));
  const bodyInput = { ...input, sourceBlocks: [block("body", "a", "paragraph", "We provide strategy consulting.")] };
  assert.equal(normalizeSources(bodyInput).filter(x => x.evidence.sourceDocumentId === "a" && x.type === "page_text").length, 0);
});

test("generic headings do not collapse children, specific headings remain usable", () => {
  const services = website("services", ["We offer strategy consulting.", "We offer implementation consulting."], "Popular Services").filter(f => f.category === "service");
  const products = website("products", ["Our Atlas software helps teams.", "Our Beacon app helps teams."], "Featured Products").filter(f => f.category === "product");
  assert.equal(new Set(services.map(f => f.topicKey)).size, 2); assert.equal(new Set(products.map(f => f.topicKey)).size, 2);
  assert.equal(website("products", ["Our software platform helps teams."], "LeadForge").find(f => f.category === "product")?.topicKey, "product:leadforge");
});

test("location wording canonicalizes conservatively and explicit lists stay distinct", () => {
  const variants = ["Our office is located in Atlanta.", "We serve Atlanta.", "Available throughout Atlanta."];
  assert.deepEqual(variants.map(text => website("locations", [text])[0]?.topicKey), ["location:atlanta", "location:atlanta", "location:atlanta"]);
  assert.notEqual(website("locations", ["We serve Atlanta."])[0]?.topicKey, website("locations", ["We serve Denver."])[0]?.topicKey);
  assert.equal(website("locations", ["Growth happens everywhere."]).length, 0);
});

test("expanded output is repeatable and independent of block input order", () => {
  const forward = website("integrations", ["We integrate with HubSpot and Salesforce.", "We integrate with Slack."]).map(f => f.id).sort();
  const reversed = website("integrations", ["We integrate with Slack.", "We integrate with HubSpot and Salesforce."]).map(f => f.id).sort();
  assert.deepEqual(forward, reversed); assert.deepEqual(forward, website("integrations", ["We integrate with HubSpot and Salesforce.", "We integrate with Slack."]).map(f => f.id).sort());
});
