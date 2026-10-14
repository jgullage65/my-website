import { reconcileWebsiteRecrawl } from "../crawler/websiteRecrawlReconciliation";
import {
  canonicalWebsiteRecrawlJson,
  planWebsiteRecrawlExtraction,
} from "../crawler/websiteRecrawlReconciliation";
import { sha256 } from "../crawler/websiteSourceRecords";
import type {
  PersistedWebsiteKnowledge,
  WebsiteKnowledgeFact,
} from "../knowledge/websiteKnowledge";
import { type ResearchFact, type ResearchSnapshot } from "./contracts";
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const key = (f: WebsiteKnowledgeFact) => f.category + "\0" + norm(f.value);
export function reconcileFacts(
  base: WebsiteKnowledgeFact[],
  supplements: ResearchFact[],
): {
  facts: WebsiteKnowledgeFact[];
  conflicts: { category: string; title: string; values: string[] }[];
} {
  // Website facts are kept byte-for-byte. Supplements never replace or re-score them.
  const facts: WebsiteKnowledgeFact[] = [...base],
    seen = new Set(base.map(key)),
    conflicts: { category: string; title: string; values: string[] }[] = [];
  const merged = new Map<string, ResearchFact>();
  for (const fact of supplements) {
    if (
      fact.research.match.classification !== "confirmed" ||
      !fact.evidence.length ||
      fact.research.state === "stale"
    )
      continue;
    const identity = key(fact);
    if (seen.has(identity)) continue;
    const existing = merged.get(identity);
    if (existing) {
      const groups = Array.from(
        new Set([
          ...existing.research.independenceGroups,
          ...fact.research.independenceGroups,
        ]),
      );
      // Identical excerpts may be syndicated even on unrelated domains; they are not independent corroboration.
      const copied = existing.evidence.some((e) =>
        fact.evidence.some((other) => norm(e.excerpt) === norm(other.excerpt)),
      );
      existing.evidence = Array.from(
        new Map(
          [...existing.evidence, ...fact.evidence].map((e) => [
            (e.sourceBlockId ?? "") + "\0" + e.url,
            e,
          ]),
        ).values(),
      );
      existing.research = {
        ...existing.research,
        independenceGroups: groups,
        corroboration:
          groups.length > 1 && !copied
            ? "independent_sources"
            : "shared_origin",
      };
      if (
        existing.research.corroboration === "independent_sources" &&
        existing.research.state === "supported"
      )
        existing.confidence = "high";
    } else merged.set(identity, structuredClone(fact));
  }
  for (const fact of Array.from(merged.values())) {
    const disagreements = [...base, ...Array.from(merged.values())].filter(
      (f) =>
        f.category === fact.category &&
        norm(f.title) === norm(fact.title) &&
        norm(f.value) !== norm(fact.value),
    );
    if (disagreements.length) {
      fact.research.state = "conflicting";
      fact.confidence = "low";
      conflicts.push({
        category: fact.category,
        title: fact.title,
        values: Array.from(
          new Set([fact.value, ...disagreements.map((f) => f.value)]),
        ),
      });
      // Remain reviewable as evidence; never feed a conflicting new assertion into the sales facts.
      continue;
    }
    facts.push(fact);
  }
  return { facts, conflicts };
}
export function asWebsiteKnowledge(
  snapshot: ResearchSnapshot,
): PersistedWebsiteKnowledge {
  return {
    schema_version: 2,
    document_version: 1,
    current_crawl_attempt_id: snapshot.attempt.id,
    imported_at: snapshot.attempt.completedAt,
    requested_url: null,
    resolved_url: null,
    pages: snapshot.pages,
    warnings: [],
    knowledge: {
      facts: snapshot.facts,
      coverage: snapshot.coverage,
      unresolvedQuestions: snapshot.unresolvedQuestions,
    },
    source_documents: snapshot.documents,
    source_blocks: snapshot.blocks,
  };
}
export function reconcileSnapshot(
  previous: ResearchSnapshot | null,
  current: ResearchSnapshot,
) {
  if (!previous) return current;
  const before = asWebsiteKnowledge(previous),
    after = asWebsiteKnowledge(current);
  const changes = reconcileWebsiteRecrawl({
    previous: before,
    current: after,
    currentCrawlAttempt: current.attempt,
    authorizeRemovals: false,
  });
  const plan = planWebsiteRecrawlExtraction({
    previous: before,
    current: after,
  });
  // Failures are observations, never authority to delete old evidence or accepted human corrections.
  const failed = new Set(
    current.outcomes.filter((o) => o.state !== "accepted").map((o) => o.url),
  );
  const preserved = previous.facts.filter((f) =>
    f.evidence.some(
      (e) =>
        failed.has(e.url) ||
        current.outcomes.some(
          (o) =>
            o.policyId === f.research.policyId &&
            ["source_unavailable", "not_found", "not_researched"].includes(o.state),
        ),
    ),
  );
  const documents = previous.documents.filter((d) =>
    preserved.some((f) => f.evidence.some((e) => e.sourceDocumentId === d.id)),
  );
  const blocks = previous.blocks.filter((b) =>
    documents.some((d) => d.id === b.sourceDocumentId),
  );
  return {
    ...current,
    facts: [
      ...current.facts,
      ...preserved.map((f) => ({
        ...f,
        research: { ...f.research, state: "stale" as const },
      })),
    ],
    documents: [...current.documents, ...documents],
    blocks: [...current.blocks, ...blocks],
    reconciliation: { ...changes, extractionPlan: plan.telemetry },
  };
}
export const snapshotFingerprint = (snapshot: ResearchSnapshot) =>
  sha256(
    canonicalWebsiteRecrawlJson({
      facts: snapshot.facts,
      documents: snapshot.documents,
      blocks: snapshot.blocks,
    }),
  );
