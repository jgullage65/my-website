# Deterministic website re-crawl reconciliation

Task 14 compares two completed, immutable Website Source Record attempts. It does
not schedule crawls and does not mutate either attempt.

## Identity and comparison rules

- Documents are grouped by normalized canonical URL, falling back to the actual
  fetched URL. Source type and source/extracted hashes determine whether the
  next version is unchanged or changed.
- Blocks are grouped beneath that cross-attempt document identity by block type,
  extraction method, and source coordinates. Normalized block text determines
  whether the block changed.
- Facts are grouped by category and normalized title. Their normalized value,
  confidence, and sorted evidence determine the fact-version hash.
- Exact versions are paired first. Remaining versions are paired in hash order;
  unmatched versions are additions or removals. This makes duplicate handling
  independent of crawler or model output order.

Every changed pair produces explicit predecessor lineage. The reconciliation
also embeds immutable fact-version snapshots so both ends of that lineage remain
inspectable after the project's current Website Knowledge changes.

## Evidence and review safety

Evidence from a removed or superseded fact is marked stale. Current evidence is
also marked stale when its document or block does not exist in the current crawl
attempt. Stale evidence is reported; it is never silently reassigned.

Website-derived assertions that have human-corrected authority are copied into
the reconciliation as preserved corrections. They are not overwritten by a new
website observation. A differing current website value is emitted as a conflict
for review.

Absence is reported as a removal candidate. It becomes authoritative only when
the matching current crawl-attempt record is supplied, completed, has no
restrictions, and the caller explicitly attests that crawl coverage is adequate.
Partial, capped, or unverified crawls cannot silently remove knowledge.

## Persistence and repeatability

The result has a canonical SHA-256 fingerprint that excludes wall-clock time.
Array ordering is canonical, so input permutation produces the same result.
Persistence is unique by project and ordered crawl-attempt pair. Identical retry
writes are idempotent; a different payload for the same identity fails closed.

The following remain outside Task 14: automatic scheduling, semantic entity
merges, automatic acceptance of changed facts, review-UI redesign, and vector
retrieval changes.
