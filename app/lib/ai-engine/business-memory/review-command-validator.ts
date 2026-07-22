import type { BusinessContextCategory } from "@/app/lib/ai-engine/contracts";
import type { ReviewState } from "./contracts";
import type {
  ReviewCommand,
  ReviewItemKind,
} from "./review-commands";

/** The persisted facts required to validate a review command, supplied by a read-only loader. */
export type AuthoritativeReviewProject = {
  id: string;
  ownerClerkUserId: string;
  status: string;
  archivedAt: string | null;
  governanceRevision: number;
  items: readonly AuthoritativeReviewItem[];
  /** A read-only duplicate-command hook; persistence is deliberately deferred. */
  hasProcessedCommandId?: (commandId: string) => boolean;
};

export type AuthoritativeReviewItem = {
  id: string;
  projectId: string;
  kind: ReviewItemKind;
  reviewState: ReviewState;
};

export type ReviewCommandValidationCode =
  | "project_not_owned"
  | "project_not_reviewable"
  | "project_archived"
  | "item_not_found"
  | "item_project_mismatch"
  | "item_kind_mismatch"
  | "stale_review_state"
  | "invalid_transition"
  | "invalid_correction"
  | "stale_revision"
  | "duplicate_command";

export type ReviewCommandValidationIssue = {
  code: ReviewCommandValidationCode;
  message: string;
};

export type ValidReviewCommand = {
  valid: true;
  command: ReviewCommand;
  project: AuthoritativeReviewProject;
  item: AuthoritativeReviewItem;
};

export type InvalidReviewCommand = {
  valid: false;
  command: ReviewCommand;
  issues: readonly ReviewCommandValidationIssue[];
};

export type ReviewCommandValidationResult = ValidReviewCommand | InvalidReviewCommand;

const REVIEWABLE_PROJECT_STATUSES = new Set(["review_required", "ready"]);
const CONTEXT_CATEGORIES = new Set<BusinessContextCategory>([
  "business_profile", "audience", "service", "pricing", "policy", "process",
  "differentiator", "faq", "behavior_rule", "prohibited_claim",
]);

const ALLOWED_TRANSITIONS: Record<ReviewCommand["kind"], ReadonlySet<string>> = {
  approve: new Set(["proposed:approved"]),
  correct: new Set(["proposed:corrected", "approved:corrected", "corrected:corrected"]),
  reject: new Set(["proposed:archived"]),
  archive: new Set(["approved:archived", "corrected:archived"]),
  restore: new Set(["archived:approved"]),
  unapprove: new Set(["approved:proposed"]),
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCorrection(command: ReviewCommand): ReviewCommandValidationIssue | null {
  if (command.kind !== "correct") return null;
  const correction = command.correction as Record<string, unknown>;
  if (correction.itemKind !== command.itemKind) {
    return { code: "invalid_correction", message: "Correction item kind must match the reviewed item." };
  }
  if (command.itemKind === "faq") {
    if (!hasText(correction.question) || !hasText(correction.answer)) {
      return { code: "invalid_correction", message: "FAQ corrections require a non-empty question and answer." };
    }
    return null;
  }
  if (!hasText(correction.content)) {
    return { code: "invalid_correction", message: "Context-entry corrections require non-empty content." };
  }
  if (correction.category !== undefined && (!hasText(correction.category) || !CONTEXT_CATEGORIES.has(correction.category as BusinessContextCategory))) {
    return { code: "invalid_correction", message: "Context-entry correction category is invalid." };
  }
  if (correction.title !== undefined && !hasText(correction.title)) {
    return { code: "invalid_correction", message: "Context-entry correction title cannot be blank." };
  }
  return null;
}

/**
 * Pure, read-only validation boundary for canonical review commands. It does not
 * load, write, or mutate persistence; callers provide authoritative data.
 */
export class ReviewCommandValidator {
  validate(command: ReviewCommand, project: AuthoritativeReviewProject): ReviewCommandValidationResult {
    const issues: ReviewCommandValidationIssue[] = [];
    const add = (code: ReviewCommandValidationCode, message: string) => issues.push({ code, message });

    if (command.projectId !== project.id || command.actor.clerkUserId !== project.ownerClerkUserId) add("project_not_owned", "The actor does not own this project.");
    if (project.archivedAt !== null) add("project_archived", "Archived projects cannot accept review commands.");
    else if (!REVIEWABLE_PROJECT_STATUSES.has(project.status)) add("project_not_reviewable", "The project is not in a reviewable state.");
    if (command.clientRevision !== project.governanceRevision) add("stale_revision", "The command revision does not match the project revision.");
    if (project.hasProcessedCommandId?.(command.commandId)) add("duplicate_command", "This command ID was already processed.");

    const item = project.items.find((candidate) => candidate.id === command.itemId);
    if (!item) add("item_not_found", "The referenced review item does not exist.");
    else {
      if (item.projectId !== project.id || item.projectId !== command.projectId) add("item_project_mismatch", "The review item does not belong to this project.");
      if (item.kind !== command.itemKind) add("item_kind_mismatch", "The review item kind does not match the command.");
      if (item.reviewState !== command.expectedCurrentState) add("stale_review_state", "The expected review state does not match the authoritative state.");
    }
    const transition = `${command.requestedTransition.from}:${command.requestedTransition.to}`;
    if (command.requestedTransition.from !== command.expectedCurrentState || !ALLOWED_TRANSITIONS[command.kind].has(transition)) add("invalid_transition", "The requested review transition is not allowed for this command.");
    const correctionIssue = validateCorrection(command);
    if (correctionIssue) issues.push(correctionIssue);

    return issues.length > 0 || !item
      ? { valid: false, command, issues }
      : { valid: true, command, project, item };
  }
}

export function validateReviewCommand(command: ReviewCommand, project: AuthoritativeReviewProject): ReviewCommandValidationResult {
  return new ReviewCommandValidator().validate(command, project);
}
