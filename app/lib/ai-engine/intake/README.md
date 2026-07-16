# AI Engine Intake

This folder turns long-form business information into structured, reviewable knowledge.

## Responsibilities

- Normalize raw intake blocks.
- Build the structured extraction request.
- Validate model-produced extraction output.
- Detect duplicates and conflicts.
- Generate grounded FAQ candidates.
- Preserve source excerpts for every extracted item.

## Never

- Write to the database.
- Update permanent business memory.
- Run retrieval for live chat.
- Generate final customer-facing answers.
- Mutate an AI builder session.

## Public entry points

```ts
import {
  extractBusinessIntake,
  validateIntakeExtraction,
  detectIntakeConflicts,
  generateFaqCandidates,
} from "@/lib/ai-engine/intake";
```

## Model integration

`extractBusinessIntake` accepts an injected `IntakeModelRunner`.

That keeps this folder independent from any specific AI SDK, model, API route, or provider.
