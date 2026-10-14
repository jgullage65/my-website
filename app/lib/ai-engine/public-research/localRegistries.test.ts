import assert from "node:assert/strict";
import test from "node:test";
import { localRegistryAdapters, registryRecord } from "./localRegistries";
import { ResearchFetcher } from "./transport";
import { researchPublicBusiness } from "./engine";
import { matchBusiness } from "./matching";
const row = { business_legal_name: "Acme Dining LLC", trade_name: "Joe's Cafe", street_address: "123 Main St", city: "SEATTLE", state: "WA", zip: "98101", city_account_number: "000123", naics_description: "Full-Service Restaurants" };
const identity = { name: "Joe's Cafe", address: "123 Main Street", city: "Seattle", state: "Washington", country: "US", category: "restaurant" };
function fetcher(record: unknown = row, license = "PUBLIC_DOMAIN") {
  const calls: URL[] = [];
  const fetcher = new ResearchFetcher(undefined, async url => {
    calls.push(url);
    const body = url.pathname === "/robots.txt" ? "User-agent: *\nCrawl-delay: 1\nDisallow: /login" : JSON.stringify(url.pathname.includes("/api/views/") ? {id:"wnbq-64tb",licenseId:license} : url.searchParams.get("$order") ? [row] : Array.isArray(record) ? record : [record]);
    return { status: 200, ok: true, headers: new Headers({"content-type":url.pathname === "/robots.txt" ? "text/plain" : "application/json"}), body: new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(body));c.close();}}) };
  }, async () => true);
  return {fetcher,calls};
}
test("Seattle DBA discovery escapes SoQL, re-fetches the unique account, confirms address and retains literal licensed evidence", async () => {
  const f = fetcher();
  const result = await researchPublicBusiness(identity, { adapters: [localRegistryAdapters[0]!], fetcher: f.fetcher });
  assert.equal(result.outcomes[0]?.state, "accepted");
  assert.equal(result.metrics.requests, 4);
  assert.equal(result.metrics.aiCalls, 0);
  assert.match(f.calls[2]!.searchParams.get("$where")!, /JOE''S CAFE/);
  assert.ok(!result.documents[0]?.actualFetchedUrl.includes("Cafe"));
  assert.ok(result.facts.some(f => /Full-Service Restaurants/.test(f.value)));
  assert.ok(result.facts.every(f => f.research.match.classification === "confirmed" && f.evidence.length));
  assert.ok(result.facts.every(f => !/growth|website contains|operating hours/i.test(f.value)));
});
test("changed or absent dataset license blocks search and retention", async () => {
  for (const license of ["", "UNKNOWN", "CC BY-NC"]) {
    const f = fetcher(row, license), result = await researchPublicBusiness(identity, { adapters:[localRegistryAdapters[0]!], fetcher:f.fetcher });
    assert.equal(result.facts.length, 0); assert.equal(f.calls.length, 2);
    assert.equal(result.outcomes[0]?.reason, "dataset_license_or_identity_changed");
  }
});
test("wrong branch, moved address, nonunique rows and substituted record IDs cannot become Seattle Intelligence", async () => {
  for (const record of [{...row, street_address:"999 Main St"}, {...row, city:"TACOMA"}, [row,row], {...row,city_account_number:"OTHER"}]) {
    const f = fetcher(record), result = await researchPublicBusiness(identity, { adapters:[localRegistryAdapters[0]!], fetcher:f.fetcher });
    assert.equal(result.facts.length, 0); assert.notEqual(result.outcomes[0]?.state, "accepted");
  }
});
test("out-of-jurisdiction discovery makes no requests and does not invent coverage", async () => {
  const f = fetcher(), result = await researchPublicBusiness({...identity,city:"Austin",state:"TX"}, {adapters: localRegistryAdapters, fetcher:f.fetcher});
  assert.equal(f.calls.length, 0); assert.equal(result.facts.length, 0);
});
test("Washington contractor structured extraction preserves status and specialty without principal names", () => {
  const record = registryRecord("washington-contractor-license-pddl", JSON.stringify([{businessname:"Acme Construction LLC",contractorlicensenumber:"ACMEC123",contractorlicensestatus:"SUSPENDED",specialtycode1desc:"GENERAL",primaryprincipalname:"DO NOT RETAIN",address1:"1 Main St",city:"Spokane",state:"WA"}]));
  assert.ok(record?.facts.some(f => f.value.endsWith("SUSPENDED")));
  assert.doesNotMatch(JSON.stringify(record?.facts), /DO NOT RETAIN/);
});
test("legal identifiers cannot override branch location conflicts and chain domains remain ambiguous", () => {
  const a = {...identity,registrationId:"123",registrationAuthority:"WA"};
  assert.equal(matchBusiness(a,{...a,address:"999 Other Rd"}).classification,"rejected");
  assert.equal(matchBusiness({name:"Chain",city:"Seattle",state:"WA",website:"chain.test"},{name:"Chain",city:"Seattle",state:"WA",website:"chain.test"}).classification,"ambiguous");
});

test("malformed short phone numbers do not confirm a same-city business", () => {
  assert.equal(matchBusiness({name:"Acme",city:"Seattle",state:"WA",phone:"123"},{name:"Acme",city:"Seattle",state:"WA",phone:"123"}).classification,"ambiguous");
  assert.equal(matchBusiness({...identity,country:"United States",postalCode:"98101-1234"},{...identity,country:"US",postalCode:"98101"}).classification,"confirmed");
});
