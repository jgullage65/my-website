# AI Builder Phase 9D emergency rollback

`runtime_authority = 'legacy'` is an immediate **chat disable** switch. It does
not and must not re-enable Trusted Knowledge, raw Business Memory, dual reads,
or parity writes in the chat request path.

The supported emergency restoration is a deployment rollback to the pre-9D
dual-read release. A later canonical-only restoration requires an operator to
restore a previously valid Assistant Projection artifact and its exact
fingerprint-bound `MATCH` parity evidence, then run the internal cutover
activation service. Historical parity rows are retained; reports missing the
artifact fingerprint cannot activate service.
