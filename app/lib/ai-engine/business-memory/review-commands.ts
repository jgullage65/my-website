import type { BusinessContextCategory } from "@/app/lib/ai-engine/contracts";
import type { ReviewState } from "./contracts";

/**
 * Server-owned contracts for the explicit review-command migration.
 *
 * A client sends an intent request and never supplies an actor or a state
 * transition. The server authenticates the actor, derives the requested
 * transition from the command kind, validates it against current authority,
 * and then constructs one of the command contracts below. Execution and
 * persistence are deliberately deferred to later phases.
 */

export type ReviewCommandKind =
  | "approve"
  | "correct"
  | "archive"
  | "restore"
  | "unapprove"
  | "reject";

/** The legacy review collections currently contain both of these item kinds. */
export type ReviewItemKind = "context_entry" | "faq";

/** Identity resolved by the server from the authenticated principal. */
export type ReviewCommandActor = {
  clerkUserId: string;
  displayName: string | null;
  email: string | null;
};

/**
 * The transition is server-derived; clients may express a command kind but
 * cannot select an arbitrary destination state.
 */
export type ReviewRequestedTransition<
  From extends ReviewState = ReviewState,
  To extends ReviewState = ReviewState,
> = {
  from: From;
  to: To;
};

/** Fields common to every server-owned review command for one source state. */
type ReviewCommandEnvelopeForState<State extends ReviewState> = {
  /** Client-generated, unique identity used for future idempotency. */
  commandId: string;
  projectId: string;
  /** Canonical claim/item identifier. It is itemId until claim IDs replace it. */
  itemId: string;
  itemKind: ReviewItemKind;
  actor: ReviewCommandActor;
  /** Optimistic-concurrency revision supplied by the client. */
  clientRevision: number;
  /** State asserted by the client and validated by the server. */
  expectedCurrentState: State;
  /** Server-derived state transition requested by this command kind. */
  requestedTransition: ReviewRequestedTransition<State>;
  /** Server creation time; not trusted when supplied by a client. */
  createdAt: string;
};

/**
 * Common command envelope, distributed by source state so a command cannot
 * pair an expected state with a transition that starts from another state.
 */
export type ReviewCommandEnvelope = {
  [State in ReviewState]: ReviewCommandEnvelopeForState<State>;
}[ReviewState];

export type ContextEntryCorrection = {
  itemKind: "context_entry";
  category?: BusinessContextCategory;
  title?: string;
  content: string;
};

export type FaqCorrection = {
  itemKind: "faq";
  question: string;
  answer: string;
};

/** Only correct commands can carry mutable review content. */
export type ReviewCorrectionPayload = ContextEntryCorrection | FaqCorrection;

type ReviewCommandForTransition<
  Kind extends Exclude<ReviewCommandKind, "correct">,
  To extends ReviewState,
> = {
  [State in ReviewState]: ReviewCommandEnvelopeForState<State> & {
    kind: Kind;
    requestedTransition: ReviewRequestedTransition<State, To>;
    correction?: never;
  };
}[ReviewState];

export type ApproveReviewCommand = ReviewCommandForTransition<"approve", "approved">;

type CorrectContextEntryReviewCommand = {
  [State in ReviewState]: ReviewCommandEnvelopeForState<State> & {
    kind: "correct";
    itemKind: "context_entry";
    requestedTransition: ReviewRequestedTransition<State, "corrected">;
    correction: ContextEntryCorrection;
  };
}[ReviewState];

type CorrectFaqReviewCommand = {
  [State in ReviewState]: ReviewCommandEnvelopeForState<State> & {
    kind: "correct";
    itemKind: "faq";
    requestedTransition: ReviewRequestedTransition<State, "corrected">;
    correction: FaqCorrection;
  };
}[ReviewState];

/** Correct commands keep the reviewed item kind and correction payload aligned. */
export type CorrectReviewCommand =
  | CorrectContextEntryReviewCommand
  | CorrectFaqReviewCommand;

export type ArchiveReviewCommand = ReviewCommandForTransition<"archive", "archived">;

export type RestoreReviewCommand = ReviewCommandForTransition<"restore", "approved">;

export type UnapproveReviewCommand = ReviewCommandForTransition<"unapprove", "proposed">;

/** Reject remains explicit because proposed-to-archived rejection exists today. */
export type RejectReviewCommand = ReviewCommandForTransition<"reject", "archived">;

/** Canonical server command union. This is the input to future validation/execution. */
export type ReviewCommand =
  | ApproveReviewCommand
  | CorrectReviewCommand
  | ArchiveReviewCommand
  | RestoreReviewCommand
  | UnapproveReviewCommand
  | RejectReviewCommand;

/**
 * Client transport contract. This intentionally omits actor and transition:
 * authentication and transition selection remain server responsibilities.
 */
export type ReviewCommandRequestEnvelope = Pick<
  ReviewCommandEnvelope,
  | "commandId"
  | "projectId"
  | "itemId"
  | "itemKind"
  | "clientRevision"
  | "expectedCurrentState"
>;

export type ApproveReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "approve";
  correction?: never;
};

export type CorrectContextEntryReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "correct";
  itemKind: "context_entry";
  correction: ContextEntryCorrection;
};

export type CorrectFaqReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "correct";
  itemKind: "faq";
  correction: FaqCorrection;
};

/** Client correction requests have the same item/payload discrimination. */
export type CorrectReviewCommandRequest =
  | CorrectContextEntryReviewCommandRequest
  | CorrectFaqReviewCommandRequest;

export type ArchiveReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "archive";
  correction?: never;
};

export type RestoreReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "restore";
  correction?: never;
};

export type UnapproveReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "unapprove";
  correction?: never;
};

export type RejectReviewCommandRequest = ReviewCommandRequestEnvelope & {
  kind: "reject";
  correction?: never;
};

export type ReviewCommandRequest =
  | ApproveReviewCommandRequest
  | CorrectReviewCommandRequest
  | ArchiveReviewCommandRequest
  | RestoreReviewCommandRequest
  | UnapproveReviewCommandRequest
  | RejectReviewCommandRequest;
