# AI Engine Knowledge

This folder converts a reviewed AI builder session into the approved knowledge pack used by retrieval and chat.

## Responsibilities

- Include only approved or corrected business facts.
- Include only approved or corrected Q&A entries.
- Preserve source IDs, confidence, and evidence.
- Produce deterministic diagnostics.
- Keep proposed and archived knowledge out of live assistant context.

## Never

- Call an AI model.
- Write to the database.
- Modify the source session.
- Generate customer-facing answers.
- Perform chat retrieval.

## Public entry point

```ts
import {
  buildKnowledgePack,
  getKnowledgeDiagnostics,
} from "@/app/lib/ai-engine/knowledge";
```
