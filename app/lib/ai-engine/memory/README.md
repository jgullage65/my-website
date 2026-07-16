# AI Engine Memory

This folder manages permanent business memory and protected conversation memory.

## Responsibilities

- Normalize and merge permanent business knowledge.
- Keep approved business facts separate from temporary thread state.
- Prevent low-signal or sidetrack messages from degrading useful thread memory.
- Build deterministic memory updates that remain auditable.
- Produce immutable memory results instead of mutating input objects.

## Never

- Call an AI model.
- Read from or write to the database.
- Perform retrieval.
- Generate customer-facing answers.
- Approve proposed business facts automatically.

## Public entry points

```ts
import {
  buildBusinessMemory,
  mergeBusinessMemory,
  buildInitialThreadMemory,
  updateThreadMemory,
} from "@/app/lib/ai-engine/memory";
```
