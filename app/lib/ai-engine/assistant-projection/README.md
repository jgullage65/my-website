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
