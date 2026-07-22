import { BUSINESS_CONTEXT_CATEGORIES } from "@/app/lib/ai-engine/contracts/business";
import type { ReviewCommandRequest, ReviewItemKind } from "./review-commands";
import type { ReviewState } from "./contracts";

const COMMAND_KINDS = ["approve", "correct", "reject", "archive", "restore", "unapprove"] as const;
const ITEM_KINDS = ["context_entry", "faq"] as const;
const REVIEW_STATES = ["proposed", "approved", "corrected", "archived"] as const;
const ENVELOPE_FIELDS = ["commandId", "projectId", "itemId", "itemKind", "clientRevision", "expectedCurrentState", "kind"] as const;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

export class ReviewCommandRequestParseError extends Error {
  readonly code: string;
  constructor(code = "invalid_review_command", message = "The review command payload is invalid.") { super(message); this.code = code; }
}

function invalid(message: string): never { throw new ReviewCommandRequestParseError("invalid_review_command", message); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid(`${label} contains an unexpected field.`);
}
export function isReviewCommandIdentifier(value: unknown): value is string { return typeof value === "string" && IDENTIFIER.test(value); }
function identifier(value: unknown, label: string): string {
  if (!isReviewCommandIdentifier(value)) invalid(`${label} is invalid.`);
  return value;
}
function state(value: unknown): ReviewState {
  if (typeof value !== "string" || !(REVIEW_STATES as readonly string[]).includes(value)) invalid("expectedCurrentState is invalid.");
  return value as ReviewState;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) invalid(`${label} must be non-empty text.`);
  return value;
}

/** Strict HTTP transport parser. Server-owned fields are deliberately not accepted. */
export function parseReviewCommandRequest(payload: unknown): ReviewCommandRequest {
  const body = object(payload, "The request body");
  const kind = body.kind;
  if (typeof kind !== "string" || !(COMMAND_KINDS as readonly string[]).includes(kind)) invalid("kind is invalid.");
  const correct = kind === "correct";
  exactKeys(body, correct ? [...ENVELOPE_FIELDS, "correction"] : ENVELOPE_FIELDS, "The review command");
  const itemKind = body.itemKind;
  if (typeof itemKind !== "string" || !(ITEM_KINDS as readonly string[]).includes(itemKind)) invalid("itemKind is invalid.");
  const base = {
    commandId: identifier(body.commandId, "commandId"), projectId: identifier(body.projectId, "projectId"), itemId: identifier(body.itemId, "itemId"),
    itemKind: itemKind as ReviewItemKind, clientRevision: body.clientRevision, expectedCurrentState: state(body.expectedCurrentState), kind,
  };
  if (!Number.isSafeInteger(base.clientRevision) || (base.clientRevision as number) < 0) invalid("clientRevision must be a non-negative integer.");
  if (!correct) return base as ReviewCommandRequest;

  const correction = object(body.correction, "correction");
  if (itemKind === "context_entry") {
    exactKeys(correction, ["itemKind", "category", "title", "content"], "correction");
    if (correction.itemKind !== "context_entry") invalid("correction.itemKind must match itemKind.");
    if (correction.category !== undefined && (typeof correction.category !== "string" || !(BUSINESS_CONTEXT_CATEGORIES as readonly string[]).includes(correction.category))) invalid("correction.category is invalid.");
    if (correction.title !== undefined) text(correction.title, "correction.title");
    return { ...base, kind: "correct", itemKind: "context_entry", correction: { itemKind: "context_entry", ...(correction.category === undefined ? {} : { category: correction.category }), ...(correction.title === undefined ? {} : { title: correction.title }), content: text(correction.content, "correction.content") } } as ReviewCommandRequest;
  }
  exactKeys(correction, ["itemKind", "question", "answer"], "correction");
  if (correction.itemKind !== "faq") invalid("correction.itemKind must match itemKind.");
  return { ...base, kind: "correct", itemKind: "faq", correction: { itemKind: "faq", question: text(correction.question, "correction.question"), answer: text(correction.answer, "correction.answer") } } as ReviewCommandRequest;
}
