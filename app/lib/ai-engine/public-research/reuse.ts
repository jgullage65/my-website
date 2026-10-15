import { parseIdentity, type BusinessIdentity, type ResearchSnapshot, type SourcePolicy, type SourceOutcome, type ResearchFact } from "./contracts";
import { matchBusiness } from "./matching";
import { policyRejection, SOURCE_POLICIES } from "./policy";
import { localRegistryAdapters } from "./localRegistries";
import { publicCoverage } from "./coverage";

/** Only identity extracted from the licensed source is retained. Never retain request/Places input here. */
export function retainedSourceIdentity(identity: BusinessIdentity): BusinessIdentity {
  const {phone: _phone, placeId: _place, website: _website, category: _category, ...allowed} = identity;
  return parseIdentity(allowed)!;
}
export function claimScopeAllowed(fact: ResearchFact, match: ReturnType<typeof matchBusiness>) {
  return match.classification === "confirmed" &&
    (fact.research.claimScope === "legal_entity" || (fact.research.claimScope === "business_location" && match.scope === "business_location"));
}
/** HTTP 304 is only a content observation: identity, scope, permissions and evidence ownership are checked separately. */
export function revalidateSource(previous: ResearchSnapshot, prior: SourceOutcome, policy: SourcePolicy | undefined, target: BusinessIdentity, now = Date.now()) {
  const rejection = policyRejection(new URL(prior.url), policy, now, "reuse");
  if (rejection || !policy) throw new Error(rejection ?? "unknown_source_permissions");
  const local = localRegistryAdapters.find(a=>a.policy.id === policy.id);
  if (local?.applicable?.(target) === false) throw new Error("source_no_longer_eligible");
  const sourceIdentity = prior.identityVersion === 1 ? parseIdentity(prior.sourceIdentity) : null;
  if (!sourceIdentity) throw new Error("cached_identity_insufficient");
  const match = matchBusiness(target, sourceIdentity);
  if (match.classification !== "confirmed") throw new Error("cached_identity_" + match.classification);
  const documents = previous.documents.filter(d=>d.actualFetchedUrl === prior.url && d.sourceContentHash === prior.fingerprint);
  if (!prior.fingerprint || documents.length !== 1) throw new Error("cached_source_binding_invalid");
  const ids = new Set(documents.map(d=>d.id)), blocks = previous.blocks.filter(b=>ids.has(b.sourceDocumentId));
  const facts = previous.facts.filter(f=>f.research.policyId === policy.id && f.research.state === "supported" &&
    f.research.sourceKind === policy.authority && claimScopeAllowed(f, match) && f.evidence.length &&
    f.evidence.every(e=>ids.has(e.sourceDocumentId ?? "") && blocks.some(b=>b.sourceDocumentId === e.sourceDocumentId &&
      (!e.sourceBlockId || e.sourceBlockId === b.id) && !!e.excerpt && b.normalizedText.includes(e.excerpt))));
  if (!facts.length) throw new Error("cached_claim_scope_or_evidence_insufficient");
  return {documents, blocks, pages:previous.pages.filter(p=>ids.has(p.sourceDocumentId)), match, sourceIdentity,
    facts:facts.map(f=>({...f,research:{...f.research,match}}))};
}
/** A new publication view; historical snapshots and already-published canonical Intelligence are never mutated. */
export function validatedCacheView(previous: ResearchSnapshot, target: BusinessIdentity, options: {policies?: readonly SourcePolicy[]; now?: number; maxAgeMs?: number} = {}): ResearchSnapshot {
  const now=options.now ?? Date.now(), policies=options.policies ?? SOURCE_POLICIES;
  const completed=Date.parse(previous.attempt.completedAt), stale=!Number.isFinite(completed) || completed>now || now-completed > (options.maxAgeMs ?? 6*60*60_000);
  const factKey = (f: ResearchFact) => JSON.stringify([f.category,f.title,f.value,f.evidence]);
  const accepted = new Map<string, ResearchFact>();
  const outcomes=previous.outcomes.map(outcome=> {
    if(outcome.state !== "accepted") return {...outcome};
    try {
      if(stale) throw new Error("cached_snapshot_stale");
      const checked=revalidateSource(previous,outcome,policies.find(p=>p.id===outcome.policyId),target,now);
      for(const fact of checked.facts) {
        accepted.set(factKey(fact), fact);
      }
      return {...outcome,match:checked.match};
    } catch(error) {return {...outcome,state:"not_reused",reason:error instanceof Error ? error.message : "cache_revalidation_failed"};}
  });
  const facts=previous.facts.flatMap(f=>{ const checked=accepted.get(factKey(f)); return checked ? [checked] : []; });
  const documentIds=new Set(facts.flatMap(f=>f.evidence.map(e=>e.sourceDocumentId)));
  const coverage=publicCoverage(facts);
  return {...previous,facts,outcomes,documents:previous.documents.filter(d=>documentIds.has(d.id)),
    blocks:previous.blocks.filter(b=>documentIds.has(b.sourceDocumentId)),pages:previous.pages.filter(p=>documentIds.has(p.sourceDocumentId)),coverage:coverage.coverage,unresolvedQuestions:coverage.missingInformation.map(m=>m.suggestedQuestion)};
}
