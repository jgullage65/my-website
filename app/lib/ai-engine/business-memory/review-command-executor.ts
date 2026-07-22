import type { ReviewState } from "./contracts";
import type { ReviewCommand, ReviewCommandExecutionResult, ReviewCommandExecutor, ReviewCorrectionPayload } from "./review-commands";
import type { ValidReviewCommand } from "./review-command-validator";

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

/** Outbox-shaped integration point; Trusted Knowledge persistence is deferred. */
export type TrustedKnowledgePreparation = {
  commandId: string;
  projectId: string;
  itemId: string;
  itemKind: ReviewCommand["itemKind"];
  reviewState: "approved" | "corrected";
  projectRevision: number;
};

/**
 * Transaction-local mutations required by the canonical governance boundary.
 * A persistence adapter must make all methods in one `transaction` callback
 * atomic; this module intentionally contains no database implementation.
 */
export interface ReviewCommandExecutionTransaction {
  updateReviewItem(input: { projectId: string; itemId: string; itemKind: ReviewCommand["itemKind"]; from: ReviewState; to: ReviewState; correction: ReviewCorrectionPayload | null }): Promise<void>;
  appendReviewHistory(entry: CanonicalReviewHistoryEntry): Promise<void>;
  incrementGovernanceRevision(input: { projectId: string; expectedRevision: number }): Promise<number>;
  updateReviewReadModels(input: { projectId: string; itemKind: ReviewCommand["itemKind"]; previousState: ReviewState; newState: ReviewState }): Promise<void>;
  prepareTrustedKnowledge(input: TrustedKnowledgePreparation): Promise<void>;
}

export interface ReviewCommandExecutionStore {
  transaction<T>(operation: (transaction: ReviewCommandExecutionTransaction) => Promise<T>): Promise<T>;
}

export type CanonicalReviewCommandExecutionResult = ReviewCommandExecutionResult & {
  history: CanonicalReviewHistoryEntry;
  trustedKnowledgePrepared: boolean;
};

function correctionFor(command: ReviewCommand): ReviewCorrectionPayload | null {
  return command.kind === "correct" ? command.correction : null;
}

function timestamp(now: () => Date): string {
  return now().toISOString();
}

/** Executes a previously validated command in exactly one store transaction. */
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

  async execute(validation: ValidReviewCommand): Promise<CanonicalReviewCommandExecutionResult> {
    // Defend the runtime boundary as well as the TypeScript-only input contract.
    if (!validation.valid) throw new Error("review_command_validation_required");
    return this.store.transaction(async (transaction) => {
      const { command, project, item } = validation;
      const previousState = item.reviewState;
      const newState = command.requestedTransition.to;
      const correction = correctionFor(command);

      await transaction.updateReviewItem({ projectId: command.projectId, itemId: command.itemId, itemKind: command.itemKind, from: previousState, to: newState, correction });
      const resultingRevision = await transaction.incrementGovernanceRevision({ projectId: command.projectId, expectedRevision: project.governanceRevision });
      const history: CanonicalReviewHistoryEntry = {
        id: this.createHistoryId(), commandId: command.commandId, projectId: command.projectId,
        itemId: command.itemId, itemKind: command.itemKind, commandKind: command.kind,
        actor: command.actor, previousState, newState, projectRevision: resultingRevision,
        correctedPayload: correction, createdAt: timestamp(this.now),
      };
      await transaction.appendReviewHistory(history);
      await transaction.updateReviewReadModels({ projectId: command.projectId, itemKind: command.itemKind, previousState, newState });
      if (newState === "approved" || newState === "corrected") {
        await transaction.prepareTrustedKnowledge({ commandId: command.commandId, projectId: command.projectId, itemId: command.itemId, itemKind: command.itemKind, reviewState: newState, projectRevision: resultingRevision });
      }
      return { commandId: command.commandId, projectId: command.projectId, itemId: command.itemId, resultingRevision, resultingState: newState, executedAt: history.createdAt, history, trustedKnowledgePrepared: newState === "approved" || newState === "corrected" };
    });
  }
}
