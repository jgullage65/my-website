# AI Engine Contracts

This folder defines the shared language of the AI engine.

## Responsibilities

- Define stable data contracts used by intake, memory, retrieval, runtime, and UI.
- Keep permanent business knowledge separate from temporary conversation memory.
- Make every AI-generated fact traceable to source evidence.
- Keep answer generation auditable through explicit context references and confidence.

## Never

- Call an AI model.
- Read from or write to a database.
- Perform retrieval.
- Mutate sessions or memory.
- Contain UI code.

## Public entry point

```ts
import type {
  BusinessContextEntry,
  DemoThreadMemory,
  RetrievalPack,
  GroundedAnswer,
  AiBuilderSession,
} from "@/lib/ai-engine/contracts";
```
