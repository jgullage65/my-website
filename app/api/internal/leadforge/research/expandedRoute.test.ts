import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { readFileSync } from "node:fs";
import { eventResponse } from "../../../../lib/ai-engine/public-research/orchestration";
const fixtures = JSON.parse(
  readFileSync("test/fixtures/research-api-v1.json", "utf8"),
);
let sourceCalls = 0;
mock.module("../../../../lib/ai-engine/public-research/store.ts", {
  namedExports: {
    runStoredPublicResearch: async () => {
      sourceCalls++;
      throw new Error("source unavailable");
    },
  },
});
mock.module("../../../../lib/ai-engine/research/leadforgeCompactResearch.ts", {
  namedExports: {
    runLeadForgeCompactResearchRequest: async () =>
      eventResponse(
        (async function* () {
          yield fixtures.cases[0].raw;
        })(),
      ),
  },
});
const { POST } = await import("./route");
const request = (body: unknown) =>
  new Request(
    "https://service.test/api/internal/leadforge/research?stream=true",
    {
      method: "POST",
      headers: { authorization: "Bearer fixture-secret" },
      body: JSON.stringify(body),
    },
  );
test("website-only authenticated requests remain unchanged", async () => {
  process.env.LEADFORGE_RESEARCH_API_SECRET = "fixture-secret";
  const response = await POST(request(fixtures.cases[0].request));
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(events[0], fixtures.cases[0].event);
  assert.equal(sourceCalls, 0);
});
test("a website result is available before the supplemental task is called", async () => {
  const response = await POST(
    request({
      ...fixtures.cases[0].request,
      businessIdentity: { name: "Acme" },
      supplemental: true,
    }),
  );
  const reader = response.body!.getReader();
  const first = await reader.read();
  const firstEvent = JSON.parse(new TextDecoder().decode(first.value).trim());
  assert.equal(firstEvent.type, "result");
  assert.equal(firstEvent.status, "complete");
  // Source failure remains a result, never an error replacing successful website data.
  let rest = "";
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    rest += new TextDecoder().decode(next.value);
  }
  const last = JSON.parse(rest.trim().split("\n").pop()!);
  assert.equal(last.type, "result");
  assert.deepEqual(
    last.businessKnowledgePack.knowledge,
    firstEvent.businessKnowledgePack.knowledge,
  );
});
test("no-website requests with identity are admitted and report insufficient evidence accurately", async () => {
  const response = await POST(request(fixtures.cases[1].request));
  assert.equal(response.status, 200);
  const event = JSON.parse((await response.text()).trim());
  assert.equal(
    event.businessKnowledgePack.research.depth,
    "insufficient_evidence",
  );
  assert.equal(
    event.businessKnowledgePack.research.websiteStatus,
    "not_provided",
  );
});
test("source requests remain gated by authentication and required identity", async () => {
  const before = sourceCalls;
  const unauthorized = await POST(
    new Request("https://service.test", { method: "POST", body: "{}" }),
  );
  assert.equal(unauthorized.status, 401);
  const invalid = await POST(
    request({ businessIdentity: { name: 123 }, supplemental: true }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(sourceCalls, before);
});

test("non-streaming website requests never wait for supplements", async () => {
  const before = sourceCalls;
  const response = await POST(
    new Request("https://service.test/api/internal/leadforge/research", {
      method: "POST",
      headers: { authorization: "Bearer fixture-secret" },
      body: JSON.stringify({
        ...fixtures.cases[0].request,
        businessIdentity: { name: "Acme" },
        supplemental: true,
      }),
    }),
  );
  assert.deepEqual(await response.json(), fixtures.cases[0].event);
  assert.equal(sourceCalls, before);
});
