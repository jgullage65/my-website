import assert from "node:assert/strict";
import test from "node:test";
import type { ReviewState } from "./contracts";
import { CanonicalReviewCommandExecutor, type CanonicalReviewHistoryEntry, type ReviewCommandExecutionLedgerEntry, type ReviewCommandExecutionStore, type TrustedKnowledgePreparation } from "./review-command-executor";
import { validateReviewCommand } from "./review-command-validator";
import type { ReviewCommand } from "./review-commands";

type State = { revision: number; reviewState: ReviewState; history: CanonicalReviewHistoryEntry[]; readModels: string[]; trusted: TrustedKnowledgePreparation[]; ledger: Map<string, ReviewCommandExecutionLedgerEntry> };

function command(overrides: Record<string, unknown> = {}): ReviewCommand {
  return { commandId: "command-1", projectId: "project-1", itemId: "faq-1", itemKind: "faq", actor: { clerkUserId: "user-1", displayName: null, email: null }, clientRevision: 4, expectedCurrentState: "proposed", kind: "approve", requestedTransition: { from: "proposed", to: "approved" }, createdAt: "2026-07-22T00:00:00.000Z", ...overrides } as ReviewCommand;
}

function validated(reviewCommand = command()) {
  const result = validateReviewCommand(reviewCommand, { id: "project-1", ownerClerkUserId: "user-1", status: "review_required", archivedAt: null, governanceRevision: 4, items: [{ id: "faq-1", projectId: "project-1", kind: reviewCommand.itemKind, reviewState: reviewCommand.expectedCurrentState }] });
  assert.equal(result.valid, true);
  if (!result.valid) throw new Error("fixture must validate");
  return result;
}

function store(state: State, failAt?: "history" | "read-model"): ReviewCommandExecutionStore {
  const commandLocks = new Map<string, Promise<void>>();
  return {
    async transaction(commandId, operation) {
      const predecessor = commandLocks.get(commandId) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => { release = resolve; });
      commandLocks.set(commandId, predecessor.then(() => current));
      await predecessor;
      const snapshot: State = { revision: state.revision, reviewState: state.reviewState, history: [...state.history], readModels: [...state.readModels], trusted: [...state.trusted], ledger: new Map(state.ledger) };
      const transaction = {
        async findCommittedCommand(id: string) { return state.ledger.get(id) ?? null; },
        async updateReviewItem(input: { to: ReviewState }) { state.reviewState = input.to; },
        async incrementGovernanceRevision() { state.revision += 1; return state.revision; },
        async appendReviewHistory(entry: CanonicalReviewHistoryEntry) { if (failAt === "history") throw new Error("history_failed"); state.history.push(entry); },
        async updateReviewReadModels(input: { previousState: ReviewState; newState: ReviewState }) { if (failAt === "read-model") throw new Error("read_model_failed"); state.readModels.push(`${input.previousState}:${input.newState}`); },
        async prepareTrustedKnowledge(input: TrustedKnowledgePreparation) { state.trusted.push(input); },
        async recordCommittedCommand(entry: ReviewCommandExecutionLedgerEntry) { state.ledger.set(entry.commandId, entry); },
      };
      try { return await operation(transaction); }
      catch (error) { Object.assign(state, snapshot); throw error; }
      finally { release(); }
    },
  };
}

test("executes a validated command atomically with history, revision, read models, and trusted preparation", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  const executor = new CanonicalReviewCommandExecutor(store(state), () => new Date("2026-07-22T01:00:00.000Z"), () => "history-1");
  const result = await executor.execute(validated());
  assert.equal(state.reviewState, "approved"); assert.equal(state.revision, 5); assert.deepEqual(state.readModels, ["proposed:approved"]);
  assert.equal(state.history.length, 1); assert.equal(state.history[0]?.commandId, "command-1"); assert.equal(state.history[0]?.projectRevision, 5);
  assert.deepEqual(state.trusted, [{ commandId: "command-1", projectId: "project-1", itemId: "faq-1", itemKind: "faq", reviewState: "approved", projectRevision: 5 }]);
  assert.equal(result.resultingRevision, 5); assert.equal(result.history.createdAt, "2026-07-22T01:00:00.000Z");
  assert.equal(result.disposition, "executed");
  assert.equal(state.ledger.get("command-1")?.historyRecordId, "history-1");
});

test("records correction payloads and prepares corrected knowledge", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  const reviewCommand = command({ kind: "correct", correction: { itemKind: "faq", question: "New?", answer: "Yes." }, requestedTransition: { from: "proposed", to: "corrected" } });
  await new CanonicalReviewCommandExecutor(store(state), () => new Date("2026-07-22T01:00:00.000Z"), () => "history-2").execute(validated(reviewCommand));
  assert.deepEqual(state.history[0]?.correctedPayload, { itemKind: "faq", question: "New?", answer: "Yes." });
  assert.equal(state.trusted[0]?.reviewState, "corrected");
});

test("rejects invalid validation results before opening a transaction", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  const invalid = { valid: false, command: command(), issues: [] } as never;
  await assert.rejects(() => new CanonicalReviewCommandExecutor(store(state)).execute(invalid), /review_command_validation_required/);
  assert.deepEqual(state, { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() });
});

test("rolls back all mutations when a transaction step fails", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  await assert.rejects(() => new CanonicalReviewCommandExecutor(store(state, "read-model")).execute(validated()), /read_model_failed/);
  assert.deepEqual(state, { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() });
});

test("replays a committed command without any additional governance mutation", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  const executor = new CanonicalReviewCommandExecutor(store(state), () => new Date("2026-07-22T01:00:00.000Z"), () => "history-1");
  const first = await executor.execute(validated());
  const replay = await executor.execute(validated());
  assert.equal(first.disposition, "executed"); assert.equal(replay.disposition, "replayed");
  assert.deepEqual({ ...replay, disposition: "executed" }, first);
  assert.equal(state.revision, 5); assert.equal(state.history.length, 1); assert.equal(state.readModels.length, 1); assert.equal(state.trusted.length, 1);
});

test("concurrent retries produce one execution and canonical replays", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  const executor = new CanonicalReviewCommandExecutor(store(state), () => new Date("2026-07-22T01:00:00.000Z"), () => "history-1");
  const results = await Promise.all([executor.execute(validated()), executor.execute(validated()), executor.execute(validated())]);
  assert.deepEqual(results.map((result) => result.disposition), ["executed", "replayed", "replayed"]);
  assert.equal(state.revision, 5); assert.equal(state.history.length, 1); assert.equal(state.readModels.length, 1); assert.equal(state.trusted.length, 1);
});

test("a rollback leaves no ledger entry and allows a later retry", async () => {
  const state: State = { revision: 4, reviewState: "proposed", history: [], readModels: [], trusted: [], ledger: new Map() };
  await assert.rejects(() => new CanonicalReviewCommandExecutor(store(state, "read-model")).execute(validated()), /read_model_failed/);
  assert.equal(state.ledger.size, 0);
  const result = await new CanonicalReviewCommandExecutor(store(state), () => new Date("2026-07-22T01:00:00.000Z"), () => "history-retry").execute(validated());
  assert.equal(result.disposition, "executed"); assert.equal(state.revision, 5); assert.equal(state.history.length, 1); assert.equal(state.ledger.size, 1);
});
