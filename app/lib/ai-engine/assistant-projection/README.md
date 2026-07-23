# Assistant Projection authority boundary

Restrictions are canonical Business Memory assertions tagged `behavior_rule` or
`prohibited_claim`. Only `approved` and `corrected` assertion states project;
`proposed`, `rejected`, `archived`, and `superseded` never do. The former
`assistant.behaviorRules` and `assistant.prohibitedClaims` fields remain
assistant configuration only: they are deliberately not transformed into
reviewed runtime knowledge.

Projection fails closed for ambiguous business identity and unresolved revision
links. A revision link is `predecessorAssertionId`; it must resolve, cannot
cycle, cannot have multiple active successors, and cannot leave both an active
predecessor and active successor authoritative. Runtime relationship validation
requires authoritative projected endpoints, projected entities, non-empty source
entry IDs, approved/corrected relationship state, and valid source/evidence
references.

## Phase 9D chat cutover

AI Builder chat serves **only** the persisted Assistant Projection. The
Assistant Projection-to-`KnowledgePack` module is a temporary shape adapter for
the chat engine; it reads the projection DTO only and is not a Trusted
Knowledge read.

A project is eligible only when all of these are true: its server-controlled
`runtime_authority` is `canonical`; a projection exists; its invalidation state
is `valid`; its projection and schema versions are supported; and its latest
parity evidence is an exact `MATCH`, records canonical authority, is for the
same projection and schema version, and was produced no earlier than that
artifact. `MINOR_DIFFERENCE`, `MAJOR_DIFFERENCE`, and `COMPARISON_FAILURE` all
block cutover. Business Memory mutations invalidate the artifact, so a valid
artifact is also required proof that no newer mutation has invalidated the
report.

`legacy` remains a migration-pending durable marker only. It never selects a
legacy runtime source: chat returns a safe migration-required 503 until an
operator completes the offline cutover. Changing it to `legacy` is **not** a
service rollback. Post-cutover rollback is operator-controlled: deploy the
last dual-read release, or restore/activate a previously validated Assistant
Projection artifact/version and produce matching offline parity evidence. No
option performs a request-time Trusted Knowledge read or destroys data.

Parity reports are preserved as operational evidence but chat neither reads
Trusted Knowledge nor creates parity reports. Before a future projection or
schema version is activated, an operator/rebuild workflow must generate an
artifact, run offline parity verification against retained historical data,
persist a `MATCH` bound to that exact version, then set canonical authority.
