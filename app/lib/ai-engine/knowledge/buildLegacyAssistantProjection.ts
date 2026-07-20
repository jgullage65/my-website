/**
 * Server-owned compatibility projection for the legacy AI Builder chat runtime.
 *
 * This is intentionally the boundary between persisted reviewed records and the
 * existing KnowledgePack-based retrieval/prompt pipeline. A later canonical
 * Business Memory reader can replace this input without changing the chat route.
 */
import "server-only";

import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { buildKnowledgePack } from "./buildKnowledgePack";
import type { KnowledgePack } from "./contracts";

export const LEGACY_ASSISTANT_PROJECTION_SOURCE =
  "server_legacy_projection" as const;

export type LegacyAssistantProjection = {
  source: typeof LEGACY_ASSISTANT_PROJECTION_SOURCE;
  knowledge: KnowledgePack;
};

/** Builds the chat-compatible projection from an owned, persisted project session. */
export function buildLegacyAssistantProjection(
  session: AiBuilderSession,
): LegacyAssistantProjection {
  // buildKnowledgePack retains the established normalization, ordering, and
  // approved/corrected filtering rules for facts, FAQs, and policy categories.
  return {
    source: LEGACY_ASSISTANT_PROJECTION_SOURCE,
    knowledge: buildKnowledgePack(session),
  };
}
