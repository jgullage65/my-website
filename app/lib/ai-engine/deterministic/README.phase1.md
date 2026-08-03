# Deterministic Business Brain Phase 1

This branch inserts bucketed architecture scaffolding between existing extraction and global deduplication.

Phase 1 guarantees:

- existing extraction remains unchanged
- every extracted fact occurrence routes to one primary bucket
- all eight compatibility specialists run
- legacy facts reconstruct in their exact original occurrence order
- downstream deterministic modules remain unchanged
- diagnostics are additive and opt-in through `shadowBuckets`

Phase 1 does not implement domain claims, specialist reasoning, conflict resolution, truth arbitration, persistence changes, or UI changes.

Required verification before merge:

```bash
node --experimental-transform-types --experimental-loader ./test/node-alias-loader.mjs --test app/lib/ai-engine/deterministic/*.test.ts app/lib/ai-engine/deterministic/routing/*.test.ts app/lib/ai-engine/deterministic/specialists/*.test.ts app/lib/ai-engine/deterministic/legacy/*.test.ts
npm run typecheck
git diff --check main...HEAD
```
