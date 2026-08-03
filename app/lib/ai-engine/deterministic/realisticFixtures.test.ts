import assert from "node:assert/strict";
import test from "node:test";
import { buildDeterministicBusinessBrain, classifyPage } from "./index";
import type { DeterministicEngineInput } from "./contracts";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "../crawler/websiteSourceRecords";

function fixture(pages: Array<{ path: string; type: string; heading: string; bodies: Array<{ type?: WebsiteSourceBlockRecord["type"]; text: string }> }>, owner?: DeterministicEngineInput["owner"]): DeterministicEngineInput {
  const sourceDocuments: WebsiteSourceDocumentRecord[] = [];
  const sourceBlocks: WebsiteSourceBlockRecord[] = [];
  const inputPages: NonNullable<DeterministicEngineInput["pages"]>[number][] = [];
  for (const [pageIndex, page] of pages.entries()) {
    const id = `document-${pageIndex}`;
    const url = `https://example.test${page.path}`;
    sourceDocuments.push({ schemaVersion: 1, id, crawlAttemptId: "attempt", actualFetchedUrl: url, canonicalUrl: url, redirectChain: [], sourceType: "html", contentType: "text/html", status: "retained", fetchedAt: "2026-08-02T00:00:00.000Z", sourceContentHash: "a".repeat(64), extractedContentHash: "b".repeat(64), language: "en", sourceTruncated: false, extractionTruncated: false, discoveryMethod: "submitted", discoveredFromUrl: null });
    inputPages.push({ url, title: page.heading, pageType: page.type, sourceDocumentId: id });
    sourceBlocks.push({ schemaVersion: 1, id: `${id}-heading`, sourceDocumentId: id, crawlAttemptId: "attempt", type: "heading", normalizedText: page.heading, coordinates: { lineStart: 1, lineEnd: 1 }, extractionMethod: "semantic_html" });
    for (const [bodyIndex, body] of page.bodies.entries()) sourceBlocks.push({ schemaVersion: 1, id: `${id}-body-${bodyIndex}`, sourceDocumentId: id, crawlAttemptId: "attempt", type: body.type ?? "paragraph", normalizedText: body.text, coordinates: { lineStart: bodyIndex + 2, lineEnd: bodyIndex + 2 }, extractionMethod: "semantic_html" });
  }
  return { pages: inputPages, sourceDocuments, sourceBlocks, owner, sessionId: "fixture-session", now: "2026-08-02T00:00:00.000Z" };
}

const scenarios = [
  ["agency", "/services", "services", "Strategy services", "We provide brand strategy consulting for growing teams.", "service"],
  ["SaaS", "/product", "products", "Workflow platform", "Our software platform enables teams to manage every workflow.", "product"],
  ["local service", "/services", "services", "Plumbing services", "We offer emergency plumbing and drain cleaning services.", "service"],
  ["ecommerce", "/products", "products", "Coffee products", "Our coffee product suite includes three single-origin roasts.", "product"],
  ["multi-location", "/locations", "locations", "Our locations", "We have offices located in Austin and Dallas and serve both areas.", "location_service_area"],
  ["policy-heavy", "/policies", "policies", "Refund policy", "Our refund policy allows returns within 30 days.", "policy"],
  ["feature-heavy", "/product", "products", "Platform features", "The platform includes reporting and enables teams to track conversions.", "feature_capability"],
  ["integrations", "/integrations", "integrations", "CRM integrations", "The platform integrates with HubSpot and Salesforce.", "integration"],
  ["testimonial", "/testimonials", "testimonials", "Customer testimonials", "Our client said working with the team increased qualified leads.", "additional_business_knowledge"],
  ["security", "/security", "security", "Platform security", "Customer data is encrypted and the platform is SOC 2 compliant.", "security_compliance"],
] as const;

for (const [name, path, type, heading, text, category] of scenarios) {
  test(`extracts realistic ${name} evidence`, () => {
    const result = buildDeterministicBusinessBrain(fixture([{ path, type, heading, bodies: [{ text }] }]));
    const fact = result.facts.find(item => item.category === category);
    assert.ok(fact, `${name} should produce ${category}; got ${result.facts.map(item => item.category).join(",")}`);
    assert.equal(fact.evidence[0]?.heading, heading);
    assert.ok(fact.evidence[0]?.sourceDocumentId);
  });
}

test("extracts structured FAQ pairs and improves FAQ coverage", () => {
  const result = buildDeterministicBusinessBrain(fixture([{ path: "/faq", type: "faq", heading: "Frequently asked questions", bodies: [
    { type: "faq_question", text: "How quickly can I get started?" },
    { type: "faq_answer", text: "Most customers can begin within two business days." },
    { type: "faq_question", text: "Can I cancel?" },
    { type: "faq_answer", text: "Yes. You can cancel before the next billing date." },
  ] }]));
  assert.equal(result.faqs.length, 2);
  assert.ok(result.coverage.frequentlyAskedQuestions >= 70);
  assert.ok(result.faqs.every(faq => faq.evidence.length === 2));
});

test("keeps multiple pricing tiers and contact methods distinct", () => {
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/pricing", type: "pricing", heading: "Plans", bodies: [{ text: "The Starter plan costs $29 per month." }, { text: "The Pro plan costs $79 per month." }] },
    { path: "/contact", type: "contact", heading: "Contact", bodies: [{ text: "Email support@example.test for support." }, { text: "Email sales@example.test for sales." }] },
  ]));
  assert.equal(result.facts.filter(fact => fact.category === "pricing_plan").length, 2);
  assert.equal(result.facts.filter(fact => fact.category === "contact_information").length, 2);
  assert.equal(result.conflicts.length, 0);
});

test("owner pricing wins a same-topic conflict and links exact session entries", () => {
  const result = buildDeterministicBusinessBrain(fixture(
    [{ path: "/pricing", type: "pricing", heading: "Starter plan", bodies: [{ text: "The Starter plan costs $29 per month." }] }],
    { additionalKnowledge: "The Starter plan costs $39 per month." },
  ));
  const conflict = result.conflicts.find(item => item.topicKey === "pricing_plan:starter");
  assert.ok(conflict);
  assert.equal(result.facts.find(fact => fact.id === conflict.preferredFactId)?.provenance, "owner");
  assert.equal(conflict.sessionEntryIds.length, 2);
  assert.ok(conflict.sessionEntryIds.every(id => result.session?.contextEntries.some(entry => entry.id === id)));
});

test("merges agreeing duplicate facts without losing independent evidence", () => {
  const statement = "Our software platform enables teams to manage every workflow.";
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/product", type: "products", heading: "Platform", bodies: [{ text: statement }] },
    { path: "/features", type: "products", heading: "Platform features", bodies: [{ text: statement }] },
  ]));
  const fact = result.facts.find(item => item.category === "feature_capability");
  assert.equal(fact?.evidence.length, 2);
  assert.ok(result.duplicateGroups.length >= 1);
  const entry = result.session?.contextEntries.find(item => item.content === statement && item.metadata.tags.includes("feature_capability"));
  assert.equal(entry?.metadata.supportingEvidence?.length, 2);
});

test("sparse pages do not create vague filler", () => {
  const result = buildDeterministicBusinessBrain(fixture([{ path: "/", type: "home", heading: "Welcome", bodies: [{ text: "Welcome to our website. Quality matters to us." }] }]));
  assert.equal(result.facts.length, 0);
  assert.ok(result.coverage.overall < 20);
  assert.ok(result.missingInformation.length > 0);
});

test("classification is structural and malformed URLs remain safe", () => {
  assert.equal(classifyPage({ url: "not a valid url", title: "Compliance and privacy" }), "compliance");
  assert.equal(classifyPage({ url: "https://example.test/customer-stories", title: "Customer stories" }), "case_studies");
  assert.equal(classifyPage({ url: "https://example.test/locations", title: "Find an office" }), "locations");
});

test("assigns one plan topic to repeated mentions without merging distinct facts", () => {
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/pricing", type: "pricing", heading: "Professional plan", bodies: [{ text: "The Professional plan costs $99 per month." }] },
    { path: "/compare", type: "pricing", heading: "Compare plans", bodies: [{ text: "The Professional plan is billed annually at $990." }] },
  ]));
  const plans = result.facts.filter(fact => fact.topicKey === "pricing_plan:professional");
  assert.equal(plans.length, 2);
  assert.equal(plans.flatMap(fact => fact.evidence).length, 2);
  assert.notEqual(plans[0]?.id, plans[1]?.id);
});

test("canonicalizes supported aliases while keeping different concepts separate", () => {
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/security", type: "security", heading: "Compliance", bodies: [{ text: "Our platform is SOC II compliant and customer data is encrypted." }, { text: "The service is HIPAA compliant." }] },
    { path: "/about", type: "about", heading: "Credentials", bodies: [{ text: "We are SOC2 certified." }] },
    { path: "/integrations", type: "integrations", heading: "Google Apps", bodies: [{ text: "The platform integrates with Google Apps." }] },
    { path: "/connectors", type: "integrations", heading: "Google Workspace", bodies: [{ text: "Connects with Google Workspace." }] },
  ]));
  assert.equal(result.facts.filter(fact => fact.topicKey === "security_compliance:soc2").length, 2,
    JSON.stringify(result.facts.map(fact => [fact.category, fact.topicKey, fact.value])));
  assert.ok(result.facts.some(fact => fact.topicKey === "security_compliance:hipaa"));
  assert.equal(result.facts.filter(fact => fact.topicKey === "integration:google_workspace").length, 2);
  assert.notEqual("security_compliance:soc2", "security_compliance:hipaa");
});

test("keeps topic identity stable across different service page structures", () => {
  const overview = buildDeterministicBusinessBrain(fixture([
    { path: "/offerings", type: "services", heading: "What We Offer", bodies: [{ text: "We provide SEO consulting for growing teams." }] },
  ]));
  const services = buildDeterministicBusinessBrain(fixture([
    { path: "/services/search", type: "services", heading: "Search engine optimization services", bodies: [{ text: "We provide search engine optimization consulting for growing teams." }] },
  ]));
  assert.ok(overview.facts.some(fact => fact.topicKey === "service:seo"));
  assert.ok(services.facts.some(fact => fact.topicKey === "service:seo"));
});

test("keeps FAQ identities isolated from aliases mentioned in questions", () => {
  const result = buildDeterministicBusinessBrain(fixture([{ path: "/faq", type: "faq", heading: "FAQ", bodies: [
    { type: "faq_question", text: "Is HIPAA supported?" },
    { type: "faq_answer", text: "Contact our compliance team for current details." },
    { type: "faq_question", text: "Does this integrate with Google Workspace?" },
    { type: "faq_answer", text: "See the integrations page for supported connections." },
  ] }]));
  const topics = result.facts.filter(fact => fact.category === "faq").map(fact => fact.topicKey);
  assert.deepEqual(topics.sort(), ["faq:does_this_integrate_with_google_workspace", "faq:is_hipaa_supported"]);
  assert.ok(topics.every(topic => topic.startsWith("faq:")));
});

test("does not replace incompatible product and feature namespaces from keywords", () => {
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/products", type: "products", heading: "Our Solutions", bodies: [
      { text: "Our Campaign Pilot product contains Google Ads automation." },
      { text: "SEO reporting includes weekly keyword tracking capabilities." },
    ] },
  ]));
  const product = result.facts.find(fact => fact.category === "product");
  const feature = result.facts.find(fact => fact.category === "feature_capability" && /SEO reporting/.test(fact.value));
  assert.equal(product?.topicKey, "product:campaign_pilot");
  assert.ok(feature?.topicKey.startsWith("feature_capability:"));
  assert.notEqual(feature?.topicKey, "service:seo");
});

test("generic container headings do not collapse distinct item facts", () => {
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/services", type: "services", heading: "What We Offer", bodies: [{ text: "We offer website design services." }, { text: "We provide conversion optimization consulting." }] },
    { path: "/products", type: "products", heading: "Our Solutions", bodies: [{ text: "Our Atlas software platform helps teams work." }, { text: "Our Beacon product enables reporting." }] },
    { path: "/industries", type: "industries", heading: "Who We Serve", bodies: [{ text: "Solutions for healthcare organizations." }, { text: "Solutions for financial services companies." }] },
    { path: "/locations", type: "locations", heading: "Where We Work", bodies: [{ text: "Our office is located in Atlanta." }, { text: "Our office is located in Denver." }] },
  ]));
  for (const category of ["service", "product", "industry_served", "location_service_area"] as const) {
    const facts = result.facts.filter(fact => fact.category === category);
    assert.equal(facts.length, 2, `${category}: ${JSON.stringify(facts)}`);
    assert.equal(new Set(facts.map(fact => fact.topicKey)).size, 2, category);
  }
});

test("removes sentence prefixes from stable pricing plan identities", () => {
  const result = buildDeterministicBusinessBrain(fixture([
    { path: "/pricing", type: "pricing", heading: "Plans", bodies: [
      { text: "The Professional plan costs $99 per month." },
      { text: "Our Professional plan costs $99 per month." },
      { text: "Choose the Professional plan for larger teams at $99 monthly." },
      { text: "Select the Professional plan at $99 monthly." },
    ] },
  ]));
  const plans = result.facts.filter(fact => fact.category === "pricing_plan");
  assert.ok(plans.length >= 3);
  assert.ok(plans.every(fact => fact.topicKey === "pricing_plan:professional"));
});

test("canonical identity preserves fact fields and evidence deterministically", () => {
  const input = fixture([{ path: "/security", type: "security", heading: "Security", bodies: [{ text: "Our platform is SOC II compliant and customer data is encrypted." }] }]);
  const first = buildDeterministicBusinessBrain(input).facts.find(fact => fact.category === "security_compliance");
  const second = buildDeterministicBusinessBrain(input).facts.find(fact => fact.category === "security_compliance");
  assert.ok(first && second);
  assert.equal(first.id, second.id);
  assert.equal(first.value, "SOC II");
  assert.equal(first.category, "security_compliance");
  assert.equal(first.provenance, "website");
  assert.equal(first.evidence[0]?.excerpt, "Our platform is SOC II compliant and customer data is encrypted.");
  assert.equal(first.confidence, second.confidence);
  assert.deepEqual(first.evidence, second.evidence);
});
