import assert from "node:assert/strict";
import test from "node:test";
import type { BusinessMemory } from "../business-memory/contracts";
import { buildAssistantProjection } from "./buildAssistantProjection";
import { evaluateAssistantProjectionFreshnessForRecord } from "./lifecycle";
import type { PersistedAssistantProjectionRecord } from "./contracts";

const time = "2025-01-01T00:00:00.000Z";
const memory = (): BusinessMemory => ({ id: "m", schemaVersion: 1, projectId: "p", assistant: { name: "A", purpose: "P", tone: "T", responseStyle: "R", primaryAudience: null, escalationInstructions: [] }, entities: [], assertions: [], relationships: [], sources: [], evidence: [], conflicts: [], missingInformation: [], createdAt: time, updatedAt: time });
const record = (overrides: Partial<PersistedAssistantProjectionRecord> = {}): PersistedAssistantProjectionRecord => { const projection = buildAssistantProjection(memory()); return { projectId: "p", businessMemoryFingerprint: projection.businessMemoryFingerprint, projectionVersion: projection.projectionVersion, schemaVersion: projection.schemaVersion, generatedAt: time, invalidationState: "valid", projection, createdAt: time, updatedAt: time, ...overrides }; };

test("assistant projection freshness explicitly identifies every stale condition", () => {
  const projection = buildAssistantProjection(memory());
  assert.deepEqual(evaluateAssistantProjectionFreshnessForRecord(null, projection), { status: "missing" });
  assert.equal(evaluateAssistantProjectionFreshnessForRecord(record(), projection).status, "current");
  for (const [change, reason] of [
    [{ businessMemoryFingerprint: "business_memory_aaaaaaaaaaaaaaaaaaaaaaaa" }, "fingerprint_mismatch"],
    [{ projectionVersion: 2 }, "projection_version_mismatch"],
    [{ schemaVersion: 2 }, "schema_version_mismatch"],
    [{ invalidationState: "invalidated" }, "invalidation_state"],
    [{ invalidationState: "failed" }, "invalidation_state"],
    [{ invalidationState: "rebuilding" }, "invalidation_state"],
  ] as const) {
    const result = evaluateAssistantProjectionFreshnessForRecord(record(change), projection);
    assert.equal(result.status, "stale"); if (result.status === "stale") assert.ok(result.reasons.includes(reason));
  }
});

test("operational Business Memory timestamps do not make a projection stale", () => {
  const first = buildAssistantProjection(memory());
  const changed = memory(); changed.updatedAt = "2026-01-01T00:00:00.000Z";
  const second = buildAssistantProjection(changed);
  assert.equal(first.businessMemoryFingerprint, second.businessMemoryFingerprint);
  assert.equal(evaluateAssistantProjectionFreshnessForRecord(record(), second).status, "current");
});
