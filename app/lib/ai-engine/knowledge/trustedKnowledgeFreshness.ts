export type ProjectionFreshness = {
  governanceRevision: number;
  trustedKnowledgeRevision: number;
  activeCanonicalCount: number;
  activeProjectionCount: number;
  mixedActiveRevisions: boolean;
};

/** A revision of zero is valid; equality and active-row consistency are authoritative. */
export function projectionFresh(freshness: ProjectionFreshness): boolean {
  return freshness.trustedKnowledgeRevision === freshness.governanceRevision
    && freshness.activeCanonicalCount === freshness.activeProjectionCount
    && !freshness.mixedActiveRevisions;
}
