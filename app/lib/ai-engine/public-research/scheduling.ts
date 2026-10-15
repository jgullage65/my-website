import type { ResearchSnapshot } from "./contracts";

export const RESEARCH_REFRESH_MS = 6 * 60 * 60_000;
// Three expedited recovery attempts; continued failures return to the normal cadence.
export const RESEARCH_RETRY_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, RESEARCH_REFRESH_MS] as const;
export function transientResearchFailure(reason: string): boolean {
  return /source_http_(?:408|425|429|5\d\d)|rate_limited|timeout|timed out|aborted|cancelled|budget_exhausted|domain_busy|getaddrinfo|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed|network|robots_unavailable|source_unavailable|discovery_failed/i.test(reason);
}
export function researchSchedule(snapshot: ResearchSnapshot | null, previousFailures: number) {
  const incomplete = !snapshot || snapshot.attempt.status === "partial" ||
    snapshot.outcomes.some(o => o.state === "source_unavailable");
  const failures = incomplete ? Math.min(RESEARCH_RETRY_MS.length, Math.max(0, Number(previousFailures) || 0) + 1) : 0;
  return { failures, delayMs: failures ? RESEARCH_RETRY_MS[failures - 1]! : RESEARCH_REFRESH_MS };
}
