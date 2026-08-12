import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route.ts";

test("rejects requests when the dedicated internal secret is not configured", async () => {
  const previous = process.env.LEADFORGE_RESEARCH_API_SECRET;
  delete process.env.LEADFORGE_RESEARCH_API_SECRET;
  try {
    const response = await POST(new Request("https://example.test/api/internal/leadforge/research", { method: "POST", body: "{}" }));
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "unauthorized");
  } finally {
    if (previous === undefined) delete process.env.LEADFORGE_RESEARCH_API_SECRET;
    else process.env.LEADFORGE_RESEARCH_API_SECRET = previous;
  }
});

test("rejects an incorrect bearer token", async () => {
  const previous = process.env.LEADFORGE_RESEARCH_API_SECRET;
  process.env.LEADFORGE_RESEARCH_API_SECRET = "correct-secret";
  try {
    const response = await POST(new Request("https://example.test/api/internal/leadforge/research", { method: "POST", headers: { authorization: "Bearer wrong-secret" }, body: "{}" }));
    assert.equal(response.status, 401);
  } finally {
    if (previous === undefined) delete process.env.LEADFORGE_RESEARCH_API_SECRET;
    else process.env.LEADFORGE_RESEARCH_API_SECRET = previous;
  }
});
