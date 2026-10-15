import { transientResearchFailure } from "./scheduling";
import { publicCoverage } from "./coverage";
import { retainedSourceIdentity, revalidateSource } from "./reuse";
import { localRegistryAdapters } from "./localRegistries";
import { randomUUID } from "node:crypto";
import { buildDeterministicBusinessBrain } from "../deterministic";
import {
  type BusinessIdentity,
  type ResearchSnapshot,
  type SourcePolicy,
  type SourceOutcome,
} from "./contracts";
import { gleifAdapter, type SourceAdapter } from "./adapters";
import { matchBusiness } from "./matching";
import { extractApprovedSource, sourceIdentities } from "./extraction";
import { reconcileSnapshot } from "./reconciliation";
import { ResearchFetcher, RESEARCH_LIMITS } from "./transport";
import { policyRejection } from "./policy";
export async function researchPublicBusiness(
  identity: BusinessIdentity,
  options: {
    signal?: AbortSignal;
    adapters?: SourceAdapter[];
    fetcher?: ResearchFetcher;
    previous?: ResearchSnapshot | null;
  } = {},
): Promise<ResearchSnapshot> {
  const started = Date.now(),
    id = "public_research_" + randomUUID(),
    fetcher = options.fetcher ?? new ResearchFetcher(options.signal);
  const empty = buildDeterministicBusinessBrain({}).websiteKnowledge;
  const snapshot: ResearchSnapshot = {
    schemaVersion: 1,
    attempt: {
      schemaVersion: 1,
      id,
      requestedUrl: "",
      normalizedSubmittedUrl: "",
      resolvedEntryUrl: "",
      startedAt: new Date(started).toISOString(),
      completedAt: new Date(started).toISOString(),
      crawlerVersion: "public-research/1",
      extractionVersion: "website-source-blocks/1",
      status: "completed",
      budgets: { ...RESEARCH_LIMITS },
      restrictions: [],
    },
    facts: [],
    documents: [],
    blocks: [],
    pages: [],
    outcomes: [],
    coverage: empty.coverage,
    unresolvedQuestions: empty.unresolvedQuestions,
    metrics: {
      requests: 0,
      bytes: 0,
      durationMs: 0,
      aiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      paidRequests: 0,
    },
  };
  const covered = new Set<string>(
    options.previous?.facts
      .filter((f) => f.research.state === "supported")
      .map((f) => f.category) ?? [],
  );
  const authority = { official_record: 3, first_party: 2, directory: 1 };
  const adapters = [...(options.adapters ?? [...localRegistryAdapters, gleifAdapter])].sort((a, b) => {
    const priority = (adapter: SourceAdapter) => {
      const missing = (adapter.supplies ?? []).filter(
        (category) => !covered.has(category),
      ).length;
      const yieldCount =
        options.previous?.facts.filter(
          (f) => f.research.policyId === adapter.policy.id,
        ).length ?? 0;
      const failed = options.previous?.outcomes.some(
        (o) =>
          o.policyId === adapter.policy.id && o.state === "source_unavailable",
      )
        ? 1
        : 0;
      return (
        (adapter.applicable?.(identity) === false ? -1000 : (adapter.priority ?? 0)) +
        missing * 10 +
        authority[adapter.policy.authority] +
        Math.min(3, yieldCount) -
        failed * 2
      );
    };
    return priority(b) - priority(a) || a.id.localeCompare(b.id);
  });
  const policies = new Map<string, SourcePolicy>(
      adapters.map((a) => [a.policy.id, a.policy]),
    ),
    seen = new Set<string>();
  // Reserve minimum useful request opportunities before any source can spend the shared budget.
  const planned: SourceAdapter[] = [];
  const deferred: SourceOutcome[] = [];
  let reserved = 0;
  const minimum = (a: SourceAdapter) => Math.max(1, a.minimumRequests ?? 2);
  for (const adapter of adapters.slice(0, RESEARCH_LIMITS.adapters)) {
    const reason = adapter.applicable?.(identity) === false ? "outside_supported_jurisdiction_or_category" :
      reserved + minimum(adapter) > RESEARCH_LIMITS.requests ? "aggregate_request_reservation" : null;
    if (reason) {deferred.push({url:adapter.policy.origin,policyId:adapter.policy.id,state:"not_researched",reason});continue;}
    planned.push(adapter); reserved += minimum(adapter);
  }
  for (let index = 0; index < planned.length; index++) {
    const adapter = planned[index]!;
    if (fetcher.signal.aborted || snapshot.facts.length >= RESEARCH_LIMITS.facts) break;
    const futureReservation = planned.slice(index + 1).reduce((n,a)=>n+minimum(a),0);
    const allowance = Math.max(0, RESEARCH_LIMITS.requests - fetcher.metrics.requests - futureReservation);
    const timeAllowance = Math.max(1, (RESEARCH_LIMITS.durationMs - (Date.now() - started)) * minimum(adapter) / (minimum(adapter) + futureReservation));
    try {
      await fetcher.withinRequestBudget(allowance, async () => {
      const candidates = await adapter.discover(identity, fetcher);
      if (!candidates.length)
        snapshot.outcomes.push({
          url: adapter.policy.origin,
          policyId: adapter.policy.id,
          state: "not_found",
          reason: "no_candidates",
        });
      let evaluated = 0;
      const candidateAllowance = Math.max(0, Math.min(RESEARCH_LIMITS.candidates,
        RESEARCH_LIMITS.aggregateCandidates - seen.size - (planned.length - index - 1)));
      for (const candidate of candidates.slice(0, RESEARCH_LIMITS.candidates)) {
        if (evaluated >= candidateAllowance || seen.size >= RESEARCH_LIMITS.aggregateCandidates) break;
        if (seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        evaluated++;
        if (
          snapshot.facts.length >= RESEARCH_LIMITS.facts ||
          fetcher.signal.aborted
        )
          break;
        const outcome: SourceOutcome = {
          url: candidate.url,
          policyId: candidate.policyId,
          state: "rejected",
          discoveredBy: candidate.discoveredBy,
        };
        snapshot.outcomes.push(outcome);
        try {
          const policy = policies.get(candidate.policyId),
            rejection = policyRejection(new URL(candidate.url), policy);
          if (rejection || !policy)
            throw new Error(rejection ?? "unknown_source");
          const prior = options.previous?.outcomes.find(
            (o) => o.url === candidate.url && o.state === "accepted" && o.identityVersion === 1 && !!o.sourceIdentity,
          );
          const response = await fetcher.get(candidate.url, policy, {
            ...(prior?.etag ? { "if-none-match": prior.etag } : {}),
            ...(prior?.lastModified
              ? { "if-modified-since": prior.lastModified }
              : {}),
          });
          if (response.status === 304) {
            if (!options.previous || !prior)
              throw new Error("not_modified_without_snapshot");
            const checked = revalidateSource(options.previous, prior, policy, identity);
            snapshot.documents.push(...checked.documents);
            snapshot.blocks.push(...checked.blocks);
            snapshot.pages.push(...checked.pages);
            snapshot.facts.push(...checked.facts.slice(0, RESEARCH_LIMITS.facts - snapshot.facts.length).map(f=>({
              ...f,research:{...f.research,validatedAt:new Date().toISOString()}
            })));
            Object.assign(outcome, prior, {state:"accepted",reason:"not_modified",match:checked.match});
            continue;
          }
          const identities = await sourceIdentities(candidate, response),
            matches = identities.map((i) => matchBusiness(identity, i));
          const confirmed = matches.filter(
            (m) => m.classification === "confirmed",
          );
          outcome.match = confirmed[0] ??
            matches[0] ?? {
              classification: "insufficient_evidence",
              signals: ["no_business_identity"],
            };
          // Multi-business pages cannot safely bind all document facts to a single business.
          if (confirmed.length !== 1 || identities.length !== 1)
            throw new Error(
              "identity_" +
                (identities.length > 1
                  ? "multiple_entities"
                  : outcome.match.classification),
            );
          const extracted = await extractApprovedSource({
            candidate,
            policy,
            response,
            attemptId: id,
            match: confirmed[0]!,
            fetchedAt: new Date().toISOString(),
          });
          snapshot.documents.push(extracted.document);
          snapshot.blocks.push(...extracted.blocks);
          snapshot.pages.push(...extracted.pages);
          snapshot.facts.push(
            ...extracted.facts.slice(
              0,
              RESEARCH_LIMITS.facts - snapshot.facts.length,
            ),
          );
          outcome.identityVersion = 1;
          outcome.sourceIdentity = retainedSourceIdentity(identities[0]!);
          outcome.state = "accepted";
          outcome.fingerprint = extracted.document.sourceContentHash;
          outcome.etag = response.headers.get("etag") ?? undefined;
          outcome.lastModified =
            response.headers.get("last-modified") ?? undefined;
        } catch (error) {
          outcome.reason =
            error instanceof Error ? error.message : "source_unavailable";
          if (transientResearchFailure(outcome.reason)) outcome.state = "source_unavailable";
        }
      }
      }, timeAllowance);
    } catch (error) {
      snapshot.outcomes.push({
        url: adapter.policy.origin,
        policyId: adapter.policy.id,
        state: "source_unavailable",
        reason: error instanceof Error ? error.message : "discovery_failed",
      });
    }
    if (index === planned.length - 1) {
      const next = deferred.findIndex(o => o.reason === "aggregate_request_reservation" &&
        minimum(adapters.find(a=>a.policy.id===o.policyId)!) <= RESEARCH_LIMITS.requests - fetcher.metrics.requests);
      if (next >= 0) planned.push(adapters.find(a=>a.policy.id===deferred.splice(next,1)[0]!.policyId)!);
    }
  }
  snapshot.outcomes.push(...deferred);
  snapshot.attempt.completedAt = new Date().toISOString();
  snapshot.attempt.status =
    snapshot.outcomes.some((o) => o.state === "source_unavailable") ||
    fetcher.signal.aborted
      ? "partial"
      : "completed";
  const coverage = publicCoverage(snapshot.facts);
  snapshot.coverage = coverage.coverage;
  snapshot.unresolvedQuestions = coverage.missingInformation.map(
    (item) => item.suggestedQuestion,
  );
  snapshot.metrics = {
    ...snapshot.metrics,
    ...fetcher.metrics,
    durationMs: Date.now() - started,
  };
  return reconcileSnapshot(options.previous ?? null, snapshot);
}
