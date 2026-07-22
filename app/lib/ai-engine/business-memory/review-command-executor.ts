import type { ReviewState } from "./contracts";
import type { ReviewCommand, ReviewCorrectionPayload } from "./review-commands";
import type { ReviewCommandValidationResult, ValidReviewCommand } from "./review-command-validator";

/**
 * Execution accepts only a successful authoritative validation result. The
 * implementation remains separate from the legacy full-session PUT route.
 */
export interface ReviewCommandExecutor {
  execute(validation: ReviewCommandValidationResult): Promise<ReviewCommandExecutionResult>;
}

/** Validation failure retained at the canonical execution boundary for HTTP mapping. */
export class ReviewCommandValidationError extends Error {
  readonly validation: Exclude<ReviewCommandValidationResult, ValidReviewCommand>;

  constructor(validation: Exclude<ReviewCommandValidationResult, ValidReviewCommand>) {
    super(validation.issues[0]?.code ?? "review_command_validation_required");
    this.validation = validation;
  }
}

export type ReviewCommandExecutionResult = {
  commandId: string;
  projectId: string;
  itemId: string;
  resultingRevision: number;
  resultingState: ReviewState;
  executedAt: string;
};

/** Whether this response performed the mutation or replayed its committed result. */
export type ReviewCommandExecutionDisposition = "executed" | "replayed";

/** Immutable audit record written with each successful governance command. */
export type CanonicalReviewHistoryEntry = {
  id: string;
  commandId: string;
  projectId: string;
  itemId: string;
  itemKind: ReviewCommand["itemKind"];
  commandKind: ReviewCommand["kind"];
  actor: ReviewCommand["actor"];
  previousState: ReviewState;
  newState: ReviewState;
  projectRevision: number;
  correctedPayload: ReviewCorrectionPayload | null;
  createdAt: string;
};

/** Transaction-local request to reconcile the persisted Trusted Knowledge projection. */
export type TrustedKnowledgePreparation = {
  commandId: string;
  projectId: string;
  itemId: string;
  itemKind: ReviewCommand["itemKind"];
  reviewState: ReviewState;
  previousReviewState: ReviewState;
  commandKind: ReviewCommand["kind"];
  actor: ReviewCommand["actor"];
  projectRevision: number;
};

/**
 * The durable, command-ID-keyed record of a committed governance mutation.
 * `result` deliberately retains the canonical response payload so retries can
 * be answered without re-reading or re-running any mutation work.
 */
export type ReviewCommandExecutionLedgerEntry = {
  commandId: string;
  projectId: string;
  itemId: string;
  resultingRevision: number;
  resultingState: ReviewState;
  executedAt: string;
  historyRecordId: string;
  trustedKnowledgePrepared: boolean;
  result: Omit<CanonicalReviewCommandExecutionResult, "disposition">;
};

/**
 * Transaction-local mutations required by the canonical governance boundary.
 * A persistence adapter must make all methods in one `transaction` callback
 * atomic; this module intentionally contains no database implementation.
 */
export interface ReviewCommandExecutionTransaction {
  /** Read a previously committed command from the transaction's authoritative ledger. */
  findCommittedCommand(commandId: string): Promise<ReviewCommandExecutionLedgerEntry | null>;
  updateReviewItem(input: { projectId: string; itemId: string; itemKind: ReviewCommand["itemKind"]; from: ReviewState; to: ReviewState; correction: ReviewCorrectionPayload | null; correctionActor: ReviewCommand["actor"] | null; correctionAt: string | null }): Promise<void>;
  appendReviewHistory(entry: CanonicalReviewHistoryEntry): Promise<void>;
  incrementGovernanceRevision(input: { projectId: string; expectedRevision: number }): Promise<number>;
  updateReviewReadModels(input: { projectId: string; itemKind: ReviewCommand["itemKind"]; previousState: ReviewState; newState: ReviewState }): Promise<void>;
  prepareTrustedKnowledge(input: TrustedKnowledgePreparation): Promise<void>;
  /** Persist the ledger entry in this same transaction after all mutation work. */
  recordCommittedCommand(entry: ReviewCommandExecutionLedgerEntry): Promise<void>;
}

export interface ReviewCommandExecutionStore {
  /**
   * Runs an atomic transaction with command-ID serialization/uniqueness.
   * Implementations must ensure concurrent calls for one commandId observe a
   * committed ledger entry before a second callback can mutate governance.
   */
  transaction<T>(commandId: string, operation: (transaction: ReviewCommandExecutionTransaction) => Promise<T>): Promise<T>;
}

export type CanonicalReviewCommandExecutionResult = ReviewCommandExecutionResult & {
  history: CanonicalReviewHistoryEntry;
  trustedKnowledgePrepared: boolean;
  disposition: ReviewCommandExecutionDisposition;
};

function correctionFor(command: ReviewCommand): ReviewCorrectionPayload | null {
  return command.kind === "correct" ? command.correction : null;
}

function timestamp(now: () => Date): string {
  return now().toISOString();
}

function isReplayOf(command: ReviewCommand, committed: ReviewCommandExecutionLedgerEntry): boolean {
  const history = committed.result.history;
  return committed.projectId === command.projectId
    && committed.itemId === command.itemId
    && history.itemKind === command.itemKind
    && history.commandKind === command.kind
    && history.previousState === command.expectedCurrentState
    && history.newState === command.requestedTransition.to
    && history.actor.clerkUserId === command.actor.clerkUserId
    && JSON.stringify(history.correctedPayload) === JSON.stringify(correctionFor(command));
}

function replay(command: ReviewCommand, committed: ReviewCommandExecutionLedgerEntry): CanonicalReviewCommandExecutionResult {
  if (!isReplayOf(command, committed)) throw new Error("review_command_id_conflict");
  return { ...committed.result, disposition: "replayed" };
}

/** Executes or replays a previously validated command in exactly one store transaction. */
export class CanonicalReviewCommandExecutor implements ReviewCommandExecutor {
  private readonly store: ReviewCommandExecutionStore;
  private readonly now: () => Date;
  private readonly createHistoryId: () => string;

  constructor(
    store: ReviewCommandExecutionStore,
    now: () => Date = () => new Date(),
    createHistoryId: () => string = () => crypto.randomUUID(),
  ) {
    this.store = store;
    this.now = now;
    this.createHistoryId = createHistoryId;
  }

  async execute(validation: ReviewCommandValidationResult): Promise<CanonicalReviewCommandExecutionResult> {
    // Retry requests naturally have stale state/revision after their first commit.
    // Check the durable ledger here, at the exactly-once execution boundary, before
    // surfacing those validation failures to the application layer.
    if (!validation.valid) {
      const mayBeReplay = validation.issues.some((issue) => issue.code === "stale_revision" || issue.code === "stale_review_state" || issue.code === "duplicate_command");
      if (!mayBeReplay) throw new ReviewCommandValidationError(validation);
      return this.store.transaction(validation.command.commandId, async (transaction) => {
        const committed = await transaction.findCommittedCommand(validation.command.commandId);
        if (committed) return replay(validation.command, committed);
        throw new ReviewCommandValidationError(validation);
      });
    }
    return this.store.transaction(validation.command.commandId, async (transaction) => {
      const { command, project, item } = validation;
      const committed = await transaction.findCommittedCommand(command.commandId);
      if (committed) return replay(command, committed);

      const previousState = item.reviewState;
      const newState = command.requestedTransition.to;
      const correction = correctionFor(command);

      const createdAt = timestamp(this.now);
      await transaction.updateReviewItem({ projectId: command.projectId, itemId: command.itemId, itemKind: command.itemKind, from: previousState, to: newState, correction, correctionActor: correction ? command.actor : null, correctionAt: correction ? createdAt : null });
      const resultingRevision = await transaction.incrementGovernanceRevision({ projectId: command.projectId, expectedRevision: project.governanceRevision });
      const history: CanonicalReviewHistoryEntry = {
        id: this.createHistoryId(), commandId: command.commandId, projectId: command.projectId,
        itemId: command.itemId, itemKind: command.itemKind, commandKind: command.kind,
        actor: command.actor, previousState, newState, projectRevision: resultingRevision,
        correctedPayload: correction, createdAt,
      };
      await transaction.appendReviewHistory(history);
      await transaction.updateReviewReadModels({ projectId: command.projectId, itemKind: command.itemKind, previousState, newState });
      // Reconcile after every state mutation. Archive, unapprove, and restore
      // are projection mutations too, not merely review-read-model changes.
      await transaction.prepareTrustedKnowledge({ commandId: command.commandId, projectId: command.projectId, itemId: command.itemId, itemKind: command.itemKind, reviewState: newState, previousReviewState: previousState, commandKind: command.kind, actor: command.actor, projectRevision: resultingRevision });
      const result: Omit<CanonicalReviewCommandExecutionResult, "disposition"> = {
        commandId: command.commandId, projectId: command.projectId, itemId: command.itemId,
        resultingRevision, resultingState: newState, executedAt: history.createdAt, history,
        trustedKnowledgePrepared: true,
      };
      await transaction.recordCommittedCommand({
        commandId: command.commandId, projectId: command.projectId, itemId: command.itemId,
        resultingRevision, resultingState: newState, executedAt: history.createdAt,
        historyRecordId: history.id, trustedKnowledgePrepared: result.trustedKnowledgePrepared, result,
      });
      return { ...result, disposition: "executed" };
    });
  }
}
