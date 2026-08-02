# Deterministic Business Brain architecture and audit

## Audit findings

The former synchronous crawl route authenticated the caller, ran the safe website crawler, persisted source records, batched every retained source block, and called `runModel` once or more per batch before returning structured knowledge. Recrawls merged model-extracted facts and persisted reconciliation records. Therefore the old crawl path was **not** model-free.

The intake route built labeled manual and website blocks, called `runEngine`, and supplied `runOpenAiIntakeModel`; it then reconciled structured website facts into that model-produced session and persisted the project. Owner priority existed in the prompt, rather than as an enforced extraction/merge rule. Review commands and project loading operate on the canonical session and repository rows after this route.

The public workspace previously used a hard-coded session and a synthetic website preview containing generic claims and empty evidence. It did not persist, but it also did not crawl the visitor's website or rebuild workspace surfaces from their entered facts.

The crawler itself retains the important protections: URL and redirect validation, DNS/private-network rejection, page and byte limits, request timeouts, same-site discovery rules, and bounded browser fallback. The new routes reuse it without relaxing those controls.

## Pipeline

1. `normalize.ts` converts website documents/blocks and owner fields to a common source contract, retaining IDs, URLs, page types, and provenance while removing repeated chrome.
2. `classify.ts` provides deterministic page classification for crawled or future document inputs.
3. `extract.ts` applies responsibility-specific explicit-signal and page-context rules. Every fact carries direct evidence; unsupported filler is not generated.
4. `merge.ts` merges exact/contained duplicates, aggregates independent evidence, detects material value conflicts, and makes owner evidence preferred without deleting website evidence.
5. `pipeline.ts` calculates supported category coverage, overall coverage, and missing categories from facts rather than page presence.
6. `assembleSession.ts` maps the result to existing session, context, FAQ, conflict, missing-information, progress, and governance-compatible contracts.

## Runtime flows

Public demo: browser form → `/api/ai-builder/demo/crawl` → safe crawler → in-memory normalization/extraction/merge/scoring → JSON response → browser state → deterministic session assembly when Build is selected. The endpoint imports no repository, telemetry writer, authentication persistence, or model provider. Refreshing or closing discards browser state.

Production: authenticated form → `/api/ai-builder/crawl` → safe crawler → durable source records → deterministic pipeline → structured website knowledge (and targeted website-knowledge update for an existing project). Intake combines original website source blocks with owner sources, assembles the deterministic canonical session, applies the existing structured-knowledge compatibility reconciliation, then persists through the existing repository. Review commands are unchanged.

## Remaining optional model work and risks

Model calls remain in chat response generation and other explicitly invoked assistant/provider modules. They are no longer used by initial crawl extraction or intake assembly. A future enhancement service should accept the immutable deterministic brain and return targeted suggestions/corrections; it should never replace evidence or the whole session.

Current heuristic limitations include complex tables, schema-only content, image text, highly implicit prose, multilingual morphology, and sophisticated near-semantic deduplication. Conflict detection currently focuses on explicit price/percentage/email values in material categories. Existing asynchronous crawl-job routes have their own legacy processing behavior and were not redirected in this change; callers should migrate them deliberately after compatibility testing. No database migration is required because existing website-knowledge and session contracts are retained.
