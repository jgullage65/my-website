# AI Builder Business Memory — Step 1 Architecture Audit

**Scope.** This is a documentation-only audit of the supplied worktree state at commit `6d70141`. The repository has no local `main` ref; `work` is the only available branch, so this report audits that exact checked-out commit rather than inferring unavailable branch history. No runtime, schema, or API behavior is changed by this report. References use `path — symbol` so each claim can be verified directly in the audited code.

## 1. Executive summary

AI Builder currently has **two durable, complementary representations**, neither of which is a general Business Memory:

1. `PersistedWebsiteKnowledge` is the source-specific crawler document. It is preserved as JSONB under `ai_builder_projects.internal_fields.website_knowledge`, carries an evidence array per website fact, and has its own `schema_version: 1`. `app/lib/ai-engine/knowledge/websiteKnowledge.ts — PersistedWebsiteKnowledge`; `app/lib/db/ai-builder-repository.ts — persistAiBuilderProject`, `normalizeWebsiteKnowledge`.
2. `BusinessContextEntry[]` plus `GeneratedFaqEntry[]` is the operational reviewed knowledge record. It is persisted relationally, is restored into `AiBuilderSession`, drives the review UI, and is the sole source for the live `KnowledgePack`. `app/lib/ai-engine/contracts/business.ts — BusinessContextEntry`, `GeneratedFaqEntry`; `app/lib/db/ai-builder-repository.ts — getAiBuilderProject`; `app/lib/ai-engine/knowledge/buildKnowledgePack.ts — buildKnowledgePack`.

The current **live canonical representation** is therefore the approved/corrected subset of session context and FAQ entries, projected at request time into `KnowledgePack`; it is canonical only for the existing assistant workflow, not for business-wide durable memory. Website knowledge is authoritative crawler provenance, but is deliberately flattened into review records and only one evidence item survives that projection. `app/lib/ai-engine/knowledge/websiteKnowledge.ts — applyStructuredWebsiteKnowledge`; `app/lib/ai-engine/knowledge/filterApprovedKnowledge.ts — filterApprovedContextEntries`, `filterApprovedFaqEntries`.

The safest insertion point is **after reviewed workflow records have been persisted/restored and before `buildKnowledgePack`**, as an idempotent canonical-memory projection with a reverse compatibility projection to the existing KnowledgePack. In the first phase, leave crawler JSON, session records, review UI, and KnowledgePack contracts untouched. A business-memory document must retain the source evidence and review decision independently rather than making `BusinessContextEntry` itself the permanent domain model.

The largest compatibility risk is changing stable identity or review-state semantics during recrawl/restoration. A website entry ID includes category, title, value, and sorted evidence URLs; changed content/title/URL therefore creates a different ID, while the restoration helper retains existing structured IDs verbatim. Changing this behavior can duplicate entries or silently lose an approved/corrected user decision. `app/lib/ai-engine/knowledge/websiteKnowledge.ts — stableWebsiteFactId`, `applyStructuredWebsiteKnowledge`.

## 2. Current lifecycle diagram

```text
Website URL
  -> POST /api/ai-builder/crawl
  -> crawlBusinessWebsite: up to 8 HTML pages, URL/page text/diagnostics
  -> OpenAI JSON-schema extraction
  -> normalizeKnowledge: evidence excerpt must occur in crawled page text
  -> client WebsiteImport + editable flat fields
  -> POST /api/ai-builder/intake
      -> PersistedWebsiteKnowledge v1 retained in project JSONB
      -> flattened manual + website intake blocks
      -> runEngine / processIntake / model extraction / validator / conflict detector
      -> proposed BusinessContextEntry + GeneratedFaqEntry + conflicts
      -> Postgres project, blocks, context, FAQ, conflicts, progress, thread
  -> review UI: edit, approve, unapprove, archive; PUT project
  -> project GET restores relational session + website JSON
      -> applyStructuredWebsiteKnowledge reconciles crawler facts by stable ID
  -> ready session -> buildKnowledgePack (approved/corrected only)
  -> demo chat POST receives pack -> retrieveKnowledge -> prompt -> OpenAI response
```

### Stage-by-stage trace

| Stage | Producer / input → output | Durable boundary, identity, status, provenance, confidence |
|---|---|---|
| Crawl | `app/api/ai-builder/crawl/route.ts — POST` calls `app/lib/ai-engine/crawler/crawlBusinessWebsite.ts — crawlBusinessWebsite`. URL → `BusinessWebsiteCrawlResult` (`requestedUrl`, `resolvedUrl`, pages `{url,title,pageType,text}`, warnings, diagnostics). | Crawl telemetry is written separately. Page text is not persisted in the project; only page descriptors are later retained. No fact status/confidence yet. |
| Website extraction and evidence validation | Crawl route sends page text to the model under `extractionSchema`, then `normalizeKnowledge(value, crawledPages)`. Model JSON → flat editable summaries plus `StructuredWebsiteKnowledge`. | Each fact requires category/title/value/confidence and ≥1 evidence item; each excerpt must be an exact substring of a crawled page keyed by canonicalized URL. Evidence array and ordinal confidence are preserved in the return payload. No persistent write on this route. |
| Website intake persistence | `app/api/ai-builder/intake/route.ts — normalizePersistedWebsiteKnowledge` accepts structured crawler output and builds `PersistedWebsiteKnowledge`. | `persistAiBuilderProject` stores it in `internal_fields.website_knowledge`; its normalizer accepts only v1, bounds facts/evidence/pages, and preserves all valid evidence entries. It has no separate fact-level DB IDs or review states. |
| Intake extraction | Intake route creates manual and flattened website `IntakeBlock`s, then `app/lib/ai-engine/runtime/runEngine.ts — runEngine` calls `processIntake`. `app/lib/ai-engine/intake/extractor.ts — extractBusinessIntake` asks for facts, FAQ candidates, conflicts, and missing information. | Input block IDs are fixed labels. Validator requires a known source block and excerpt matching that block. Fact temporary ID is supplied by model or deterministic hash of `sessionId/category/content/sourceBlockId`; FAQ hash is session/question/answer. Confidence label and score survive. |
| Conflict and proposed review records | `processIntake` combines validated model conflicts and `detectIntakeConflicts`; `runEngine` makes `AiBuilderSession`. | `processIntake` maps source block/excerpt to one `BusinessContextSource`; `runEngine.mapFaqEntries` only carries `sourceFactIds`, and `mapConflicts` only excerpts. All entries start `proposed`; no automatic promotion. |
| Relational persistence | `app/lib/db/ai-builder-repository.ts — persistAiBuilderProject`. | Upserts project, blocks, context entries, FAQs, conflicts, missing info, progress, and initial thread. Context source/metadata and FAQ source-entry IDs are JSONB. Existing rows not present in a later session are not deleted. |
| Restoration / reconciliation | `getAiBuilderProject` rehydrates `AiBuilderSession`; project GET returns it and the website document. `AiBuilderClient.restoreWebsiteReviewKnowledge` calls `applyStructuredWebsiteKnowledge`. | Context/FAQ rows are restored by DB primary key. Website helper removes legacy website entries that are not in the current structured-ID set, retains current IDs exactly (including corrections/status), and creates absent crawler facts as proposed. |
| Review / correction | `app/components/ai-builder/AiBuilderReview.tsx — AiBuilderReview`. | UI changes one object’s title/content/status and `metadata.userEdited`; removal means `archived`. “Approve all” preserves `corrected`, skips archived. Client PUT writes updates only for row IDs already present. It does not update provenance, confidence, or source histories. |
| Approved assistant projection | `buildKnowledgePack(session)`. | Only `approved`/`corrected` context and FAQ records participate. Fact ID becomes `knowledge_${entry.id}`; FAQ similarly. One source object/excerpt/URL and confidence survive for facts; FAQ retains only source IDs. Pack is in-memory (builtAt changes each build), not persisted. |
| Demo chat | `AiBuilderClient` builds pack only when session status is `ready`, passes it to `AiBuilderDemoChat`; `/api/ai-builder/chat` calls `retrieveKnowledge` and `buildSystemPrompt`. | Chat receives only the client-provided pack, persists messages/citations, and does not read source records. Current string-match retrieval returns rendered strings, so citations have no durable source identity in the response path. `app/lib/ai-engine/chat/retrieveKnowledge.ts — retrieveKnowledge`. |

## 3. Current model inventory

| Representation | Purpose / canonicality | Preserved → lost through next transformation | Relationships / multiple sources / safe correction |
|---|---|---|---|
| `CrawledBusinessPage` | Ephemeral crawl evidence input. `crawler/crawlBusinessWebsite.ts — CrawledBusinessPage`. | URL/title/type/text → extraction schema gets all; project retains only URL/title/type. Page text and fetch history are lost from project data. | No relationships; one page per value but extraction can cite several. Not reviewable. |
| `WebsiteKnowledgeFact` / `StructuredWebsiteKnowledge` | Source-specific, evidence-backed website extraction. Transitional to workflow records, canonical for the retained website import document. | category/title/value/confidence/evidence[] plus coverage/unresolved questions → one flat review entry with category mapping, title/content, label+derived score, first evidence only. | Cannot express typed relations; evidence[] supports multi-source evidence. Corrections happen elsewhere, not on this fact. |
| `PersistedWebsiteKnowledge` | Versioned crawler-import document, retained JSONB for reopening/reconciliation. | Keeps structured facts/evidence[], page descriptors, requested/resolved URL, warnings and crawl IDs; no page text, source revision, per-fact status, or correction links. | Multiple evidence excerpts yes; relationships no; user correction safely survives only indirectly when an ID is unchanged. |
| `IntakeBlock` | Raw manual/flattened website prompt material and source anchor. Workflow input, not canonical knowledge. | label/content/times → model-derived source block IDs/excerpts. Original page-level website attribution is flattened into broad blocks. | No relations/multi-source record. User edits do not amend the source block. |
| `ExtractedBusinessFact` / FAQ/conflict candidates | Validated model intermediate. `intake/contracts.ts`; `validator.ts`. | Fact supports one block/excerpt; FAQ candidate temporarily supports arrays of block IDs/excerpts/fact IDs. Mapping to FAQ loses block IDs/excerpts; context keeps one source. | Flat facts; FAQ has many source fact IDs; corrections only after mapping. |
| `BusinessContextEntry` | Relational review workflow record and current operational source of truth. | Keeps text, category, confidence, status, one source, metadata/tags/timestamps. KnowledgePack preserves most but removes status, timestamps, metadata flags/conflicts and starts with only a single source. | No typed entity/attribute/relation; exactly one source. User edits are safe for the row but overwrite values without provenance/history. |
| `GeneratedFaqEntry` | Reviewable generated Q&A. | Keeps question/answer/confidence/source IDs/status/times; KnowledgeFaq loses status/timestamps. | Can point to many fact rows but has no evidence records or semantics beyond IDs. Editable but corrections not recorded as a separate revision. |
| `IntakeConflict` | Review prompt / diagnostic, persisted relationally. | Statements/excerpts/question/resolution retained; no linked fact IDs in final session model. | Represents disagreement textually, not a source-to-claim relation. Project PUT does not persist conflict edits. |
| legacy `BusinessMemory` | Namespace/type naming only: `sessionId`, `entries: BusinessContextEntry[]`, version, updatedAt. `contracts/memory.ts — BusinessMemory`. | No separate persistence path or graph semantics. | It is an alias-shaped wrapper, not the requested domain model. `memory/businessMemory.ts` deduplicates entries by row ID only. |
| `KnowledgeFact`, `KnowledgeFaq`, `KnowledgePack` | Read-only compatibility projection for retrieval/chat. | Packs facts/FAQ, assistant configuration, and one source per fact. Drops archived/proposed, review state, history, conflicts, evidence arrays, entity meaning, relationships. | FAQ supports many source IDs; otherwise no relationships or multiple sources. Not user-editable. |
| `ContextCandidate` / retrieved string arrays | Retrieval/chat transient context. | Candidate can carry `sourceEntryId`; current demo retrieval returns strings and loses it. | No domain relations or source history; no corrections. |

## 4. Producer and consumer map

**Producers:** crawler (`crawlBusinessWebsite`); crawl API model extraction and `normalizeKnowledge`; intake API normalizers and block builder; intake extractor/validator/normalizer/conflict detector; runtime `runEngine`; UI review mutations; project restoration reconciliation. `app/api/ai-builder/crawl/route.ts — POST`; `app/api/ai-builder/intake/route.ts — POST`; `app/lib/ai-engine/intake/{extractor,validator,normalizer,conflictDetector}.ts`; `app/components/ai-builder/{AiBuilderReview,AiBuilderClient}.tsx` (the latter file is `AiBuilderClient.tsx`).

**Transformers:** website fact category mapping and stable-ID reconciliation (`websiteKnowledge.ts`); candidate validation/deduplication (`validator.ts — dedupeByKey`); proposed entry/FAQ mapping (`runEngine.ts`); approved filter and KnowledgePack projection; chat retrieval/prompt creation. `app/lib/ai-engine/knowledge/{websiteKnowledge,filterApprovedKnowledge,buildKnowledgePack}.ts`; `app/lib/ai-engine/chat/{retrieveKnowledge,buildSystemPrompt}.ts`.

**Persistence/restoration/API consumers:** `ai-builder-schema.ts` defines tables; repository writes/reads all workflow objects and website JSON; project GET/PUT exposes and saves review session; chat API consumes client pack and writes chat messages. `app/lib/db/{ai-builder-schema,ai-builder-repository}.ts`; `app/api/ai-builder/projects/[projectId]/route.ts`; `app/api/ai-builder/chat/route.ts`.

**UI and chat consumers:** `AiBuilderReview` controls statuses; `AiBuilderClient` gates pack creation on `ready`; `AiBuilderDemoChat` consumes `KnowledgePack`; diagnostics inspect pack. `app/components/ai-builder/{AiBuilderReview,AiBuilderClient,AiBuilderDemoChat}.tsx`; `app/lib/ai-engine/knowledge/knowledgeDiagnostics.ts`.

**Tests:** no test or spec files were found in the repository, and `package.json` exposes no test script. This is a current validation gap, not evidence that behavior is unimportant.

## 5. Identity and deduplication analysis

- **Website facts.** `stableWebsiteFactId` normalizes whitespace/case and hashes `category`, `title`, `value`, and sorted evidence URLs—not excerpts. Same semantic value on the same URL(s) remains stable despite excerpt wording/order changes; changing title, value, category, or URL changes identity. Hash is 32-bit FNV-style and is not collision-checked. `websiteKnowledge.ts — stableWebsiteFactId`.
- **Recrawl/reopen.** Reconciliation builds the current structured ID set. It keeps old website-derived rows only when their IDs remain in that set and then skips recreating them; therefore approved/corrected status and user text survive if identity stays identical. A changed identity causes the prior website row to be removed from the in-memory restored session and a new proposed row created. The removal is not written back by PUT because PUT only updates submitted IDs and inserts nothing; the old relational row remains and may reappear on future raw repository restoration until reconciliation filters it. `websiteKnowledge.ts — applyStructuredWebsiteKnowledge`; project route `PUT`.
- **Manual/generated facts.** `stableIntakeId` gives fallback IDs based on session/category/content/source block. Model-supplied `temporaryId` is accepted after text normalization, so uniqueness is not independently enforced beyond validator dedupe keys. Each new intake uses a new session ID, so cross-project dedupe does not exist. `intake/validator.ts — validateFact`, `validateFaq`; `intake/normalizer.ts — stableIntakeId`.
- **FAQ identities.** FAQ IDs are model temporary IDs or fallback session/question/answer hashes. FAQ source IDs do not participate in fallback identity, so same question/answer but changed evidence maps to same fallback ID. `validator.ts — validateFaq`; `runEngine.ts — mapFaqEntries`.
- **Persistence constraints.** Context and FAQ IDs are global table primary keys, not `(project_id,id)`. Upsert conflict keys are IDs, so a collision could overwrite another project’s row/relationship fields. The current project PUT uses `UPDATE ... WHERE id AND project_id`, avoiding cross-project update but silently does nothing for client-created IDs. `ai-builder-schema.ts`; repository `persistAiBuilderProject`; project route `PUT`.
- **KnowledgePack IDs.** These are deterministic wrappers (`knowledge_${entry.id}`), not independent identity; ID collision behavior is inherited from workflow entries. `buildKnowledgePack.ts — mapFact`, `mapFaq`.
- **Duplicates/conflicts.** Validator deduplicates facts by category/content and FAQ by question/answer (normalized); conflict detector surfaces exact duplicates or textual contradictions within a single intake result but does not merge them. It does not compare persisted manual versus website structured entries, nor compare across recrawls/projects. `validator.ts — validateIntakeExtraction`; `conflictDetector.ts — detectIntakeConflicts`.

## 6. Provenance analysis

- **Several excerpts for one website fact:** `PersistedWebsiteKnowledge` retains up to eight validated evidence items, but `applyStructuredWebsiteKnowledge` selects `fact.evidence[0]`. The context row and every downstream KnowledgeFact retain only that first URL/excerpt. `websiteKnowledge.ts — applyStructuredWebsiteKnowledge`; repository `normalizeWebsiteKnowledge`.
- **Same fact on several pages:** evidence URLs participate in website identity. Adding/removing a corroborating page changes identity and therefore makes a proposed replacement rather than enriching the existing reviewed fact. No source set or source history is attached to the review entry.
- **Website and manual agree:** both become intake content. Deduplication can remove exact normalized duplicate extracted facts, but it does not preserve a many-source assertion; the surviving context fact has one source block/excerpt. Whether the model selects manual or website is not deterministic from code. The prompt gives manual higher authority but it is an instruction, not an enforced merge rule. `intake/route.ts — assistantPurpose`; `validator.ts`.
- **Sources disagree:** the model is instructed to prefer manual and not repeat conflicting website claims; model and deterministic detectors may produce a conflict. `IntakeConflict` stores statement/excerpts, not source IDs; neither the review UI nor KnowledgePack resolves/records a winning source relationship. `intake/route.ts`; `runEngine.ts — mapConflicts`; `AiBuilderReview.tsx`.
- **User corrects website fact:** UI changes content/title and status to `corrected` but leaves the source as website and retains no editor, rationale, prior value, correction timestamp beyond `updatedAt`, or link to the changed claim. A subsequent recrawl with same stable raw identity retains the correction; a changed ID loses it from reconciled display. `AiBuilderReview.tsx`; `websiteKnowledge.ts`.
- **Website changes/disappears:** persisted website document is overwritten only when a new intake POST persists one. There is no source snapshot/revision history or tombstone. Reconciliation only sees the latest persisted document; absent/changed facts are filtered in memory as above. Crawler telemetry is operational metadata, not evidence history. `repository.ts — persistAiBuilderProject`; `telemetry/ai-builder-telemetry.ts`.
- **Confidence changes:** raw confidence persists on website facts and rows; first website fact mapping derives a fixed .9/.7/.5 score. Editing does not adjust either value; no confidence provenance/history exists. `websiteKnowledge.ts — confidenceScore`; `AiBuilderReview.tsx`.
- **Archive:** entry status stays relationally persisted and excluded from pack. Project archive is separate soft deletion at `projects.archived_at`; it hides the entire project, not an evidence/source lifecycle. `filterApprovedKnowledge.ts`; `repository.ts — archiveAiBuilderProject`.

## 7. Relationship-gap analysis

All current fact models are flat `title` + text `content` with a broad category. There are no entity IDs, typed predicates, object references, cardinality, ordering, or effective dates. Consequently each example can be *written as prose* but cannot be queried/validated as a relation:

| Required concept | Current limitation |
|---|---|
| Service available at location | `service` and `business_profile` can contain text, but no `available_at(service, location)` link. |
| Product with price | Separate service/pricing facts cannot identify product and price as related, currency/unit/effective date. |
| Policy applying to service | Policy text cannot target a service ID. |
| Customer segment targeted by offer | Audience/service facts have no target relationship. |
| Ordered process steps | `process` is a single fact; no step entity or ordinal. |
| Guarantee attached to product | Guarantee maps to policy in website adapter; its product attachment is lost. |
| FAQ supported by several canonical facts | FAQ has `sourceEntryIds`, but these are workflow row IDs, not stable canonical assertions/evidence, and no semantics say which claim supports which answer. |

Sources: `business.ts — BusinessContextEntry`, `GeneratedFaqEntry`; `websiteKnowledge.ts — WEBSITE_FACT_CATEGORIES`; `knowledge/contracts.ts`.

## 8. Compatibility constraints

### Hard requirements

- Preserve all existing Postgres tables/rows, `internal_fields.website_knowledge` v1 documents, IDs, and JSON field shapes while old readers exist. `ai-builder-schema.ts`; repository normalizers.
- Preserve exact review statuses: live pack includes only `approved` and `corrected`; archive must remain excluded; counters and UI actions must retain their current meanings. `filterApprovedKnowledge.ts`; `AiBuilderReview.tsx`.
- Preserve deterministic website IDs and reconciliation behavior until an explicit compatibility adapter is in place; old projects must reopen with corrections/statuses intact where existing identity permits. `websiteKnowledge.ts`.
- Preserve project GET response (`session`, `builder`, `websiteKnowledge`, `chatThread`), PUT session save behavior, crawl/intake streams, and chat request’s KnowledgePack shape. `api/ai-builder/projects/[projectId]/route.ts`; `api/ai-builder/{crawl,intake,chat}/route.ts`.
- Preserve relational project restoration, ownership/archive filtering, initial chat thread and existing serialized assistant configuration/context counts. `repository.ts — getAiBuilderProject`, `persistAiBuilderProject`.
- Preserve `KnowledgePack` facts/FAQ/behavior/prohibited fields and client’s `ready` gate so demo chat behavior does not change. `knowledge/contracts.ts`; `AiBuilderClient.tsx`.

### Safely changeable implementation details

- Add new Business Memory tables/JSONB documents and versioned adapters without altering current tables in the first release.
- Improve internal retrieval, scoring, source normalization, and relationship representation behind a projection, provided the existing pack output remains equivalent.
- Add durable history/version records and indexes; replace the current in-memory “BusinessMemory” wrapper once compatibility exports remain or consumers migrate.
- Later change web fact hash internals only with an explicit old-ID mapping/migration and regression fixtures.

## 9. Recommended canonical boundary

**Boundary:** accept raw crawler and manual intake as immutable/source-specific ingestion records; make a canonical `BusinessMemory` projection only after validation and user review state are available, preferably after the project session has been persisted or restored. This makes the workflow records the review command surface while memory becomes a durable read model with a link back to every workflow record and source.

**KnowledgePack:** do not replace it in Step 1. Generate it as a compatibility projection from approved/current Business Memory *or*, during transition, reconcile memory with existing approved session entries and retain the present `buildKnowledgePack(session)` output. The pack is chat-specific and cannot become the canonical layer.

**Keep source-specific:** retain `PersistedWebsiteKnowledge` as website ingestion/evidence document and keep its v1 reader. Do not flatten it further or treat it as a cross-business domain graph.

**Keep workflow records:** `BusinessContextEntry`, `GeneratedFaqEntry`, conflicts, review UI, and counters remain workflow records/adapters. The initial implementation should leave `AiBuilderReview.tsx`, crawler schema, current tables, and public API responses untouched; add a new contract, mapper, persistence reader/writer, and projection tests only.

## 10. Proposed TypeScript domain contracts

```ts
export type BusinessEntityType =
  | "business" | "service" | "product" | "policy" | "customer_segment"
  | "location" | "process" | "process_step" | "pricing_concept"
  | "contact_method" | "differentiator" | "guarantee" | "custom";

export type BusinessRelationshipType =
  | "offers" | "available_at" | "priced_as" | "governed_by"
  | "targets" | "contains" | "has_step" | "guarantees" | "supports"
  | "applies_to" | "located_at" | "custom";
export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";
export type ReviewState = "proposed" | "approved" | "corrected" | "archived";
export type LifecycleState = "active" | "superseded" | "retracted" | "archived";

export type EvidenceRecord = {
  id: string; sourceId: string; excerpt: string; locator?: { url?: string; blockId?: string; pageTitle?: string };
  capturedAt: string; contentHash?: string; validation: "validated" | "unverified" | "invalid";
};
export type KnowledgeSource = {
  id: string; owner: "website" | "manual_intake" | "user_edit" | "generated_qa" | "system";
  externalId?: string; url?: string | null; title?: string; documentVersion?: string;
  capturedAt: string; observedAt?: string; lifecycle: LifecycleState;
};
export type ReviewRecord = {
  state: ReviewState; decidedAt?: string; decidedBy?: string; reason?: string;
  workflowEntryIds: string[]; priorRevisionIds: string[];
};
export type BusinessAttribute = {
  id: string; entityId: string; key: string; value: unknown; valueType: "text" | "number" | "money" | "boolean" | "json";
  unit?: string; currency?: string; confidence: { level: ConfidenceLevel; score: number | null; rationale?: string };
  evidenceIds: string[]; review: ReviewRecord; lifecycle: LifecycleState; version: number;
  createdAt: string; updatedAt: string;
};
export type BusinessEntity = {
  id: string; stableKey: string; type: BusinessEntityType; customType?: string;
  name: string; aliases: string[]; tags: string[]; attributeIds: string[];
  sourceIds: string[]; evidenceIds: string[]; review: ReviewRecord; lifecycle: LifecycleState;
  version: number; createdAt: string; updatedAt: string;
};
export type BusinessRelationship = {
  id: string; stableKey: string; type: BusinessRelationshipType; customType?: string;
  fromEntityId: string; toEntityId: string; attributes: Record<string, unknown>;
  order?: number; evidenceIds: string[]; sourceIds: string[];
  confidence: { level: ConfidenceLevel; score: number | null; rationale?: string };
  review: ReviewRecord; lifecycle: LifecycleState; version: number; createdAt: string; updatedAt: string;
};
export type BusinessMemory = {
  schemaVersion: 1; id: string; owner: { projectId: string; businessId: string };
  entities: BusinessEntity[]; attributes: BusinessAttribute[]; relationships: BusinessRelationship[];
  sources: KnowledgeSource[]; evidence: EvidenceRecord[]; aliases: Record<string, string[]>;
  tags: string[]; version: number; createdAt: string; updatedAt: string;
};
```

`stableKey` is a deterministic, namespaced semantic key whose inputs are documented per mapper; immutable `id` is generated once. Revisions increment rather than overwrite, and `ReviewRecord` links workflow IDs. `custom` plus `customType`, JSON attributes, tags, and typed relationship attributes make the model extensible without hard-coding only today’s categories. Canonical assertions can be represented as an entity + attribute or relationship, each with many evidence/source IDs.

## 11. Persistence recommendation

### Current provenance-shadow boundary

The existing canonical provenance shadow tables are an **audit, provenance, and governance-history layer**; they are not complete Business Memory persistence. During the current migration stage, legacy AI Builder persistence remains authoritative. The provenance shadow is not the persistence model for the new canonical `BusinessMemory`, and shadow-writing must not be read as a canonical Business Memory cutover, runtime integration, or retrieval integration.

Future Business Memory persistence will be designed separately for canonical entities, assertions, relationships, conflicts, missing information, assistant configuration, and other Business Memory structures. Initial provenance-shadow writes are non-authoritative and may fail without breaking the authoritative legacy project save. Governance and review shadow writes, by contrast, are intentionally atomic with their matching legacy review mutations.

Use Postgres with a versioned `business_memory` JSONB document per project initially, plus an append-only `business_memory_revisions`/source-event table when history becomes active. JSONB matches existing project persistence and allows contracts to evolve; normal relational tables can be introduced later for indexed entity/relationship queries without changing the canonical contract. Store source/evidence records separately or de-duplicated by IDs inside the document; never rely on a caller’s pack to reconstruct them. Do not use an external graph database.

A new memory row should contain `schema_version`, deterministic mapper version, source snapshot links (`website_knowledge` document version/crawl attempt and workflow row IDs), and `built_from` fingerprint. Upsert only when the normalized input fingerprint changes. Keep source snapshots immutable and mark lifecycle/revisions rather than deleting them.

## 12. Migration and backward compatibility plan

1. **Read first:** add a pure v1 reader for current `PersistedWebsiteKnowledge` and an adapter from restored context/FAQ rows. Do not alter `normalizeWebsiteKnowledge`; old projects without memory simply build it lazily in memory.
2. **Idempotent backfill:** map current reviewed entries into Business Memory. Preserve `approved`, `corrected`, and `archived` as review/lifecycle records; attach original `source`, metadata/tags, FAQ source IDs, and all retained website evidence. Fingerprint canonical input and mapper version so retry/reopen is deterministic.
3. **Dual read:** on project load, read memory if its schema/mapper version is supported; otherwise build an ephemeral projection from legacy rows. Existing UI still receives legacy session shape.
4. **Compatibility projection:** retain `buildKnowledgePack(session)` initially; add snapshot comparison against `buildKnowledgePack(projectBusinessMemory(...))` before switching production reads. The new projection must reproduce IDs, ordering, source URL behavior, status filtering, FAQ IDs, and assistant settings.
5. **Dual write only after equivalence:** write the legacy workflow rows exactly as today and write/update Business Memory transactionally after review save. A failed memory write must not reject an existing review save; mark it rebuildable.
6. **Rollback:** feature flag canonical read; turning it off falls back to legacy tables because they remain untouched. Do not make KnowledgePack/chat depend exclusively on memory until backfill and comparison telemetry are clean.
7. **Database migration:** not required for contracts, mapper, or lazy dual-read. It becomes required when persisting the new memory document/revisions (new additive tables/indexes only). Never rewrite/delete old rows as part of that migration.
8. **Project reopening:** before migration, v1 JSON and relational rows restore exactly as now. After migration, loader reads memory when valid but still returns the same restored session and website payload; unsupported/missing documents regenerate safely.

## 13. Phased implementation sequence

| Phase | Purpose / likely files | Risk, tests, done / explicitly excluded |
|---|---|---|
| 0. Characterization | Add fixtures/tests around `websiteKnowledge.ts`, `buildKnowledgePack.ts`, repository hydration. | Low. Test stable IDs, multi-evidence first-source behavior, statuses, pack ordering, restore corrections. Done when current behavior is locked. No schema/UI changes. |
| 1. Pure contracts + mapper | New `app/lib/ai-engine/business-memory/{contracts,fromLegacy}.ts`; read-only adapter from session + persisted website document. | Low-medium. Unit test deterministic/idempotent mapping and evidence retention. Done when no existing code path consumes it. No DB migration, UI, chat switch, or recrawl change. |
| 2. Additive persistence + lazy read | New schema/repository functions and additive tables/JSONB only. | Medium. Integration tests old/missing/invalid/memory-v1 paths and rollback. Done when legacy projects reopen unchanged. No replacement of legacy writes. |
| 3. Review write projection | Hook review save/repository persistence to rebuild memory from workflow records, retain revision/audit links. | Medium-high. Test approve/correct/archive and source-change behavior. Done when dual writes are idempotent. No UI redesign or changed review semantics. |
| 4. Compatibility pack projection | Implement memory→KnowledgePack adapter behind flag and compare snapshots. | High. Golden tests for old projects and demo chat payload. Done at output equivalence. No new retrieval behavior. |
| 5. Relationship/source-aware capabilities | Add relationship management, source history, sync/merge APIs after canonical layer is proven. | High/product-dependent. Tests entity/relationship cardinality, source conflict and merge. Do not bundle with initial memory introduction. |

## 14. Test strategy

- Unit tests: crawl evidence validation; website fact stable-ID matrix (case/excerpt/order vs title/value/URL changes); v1 normalization limits; legacy-to-memory mapping; source/evidence preservation; revision and lifecycle transitions.
- Repository integration tests: persist/reopen existing rows, archived project exclusion, missing memory fallback, idempotent backfill, transaction/rollback behavior, global-ID collision defense.
- UI/API contract tests: GET/PUT serialized session and website document unchanged; review counters/actions; correct/approve/archive persistence; crawl and intake stream payloads.
- Golden compatibility tests: legacy `buildKnowledgePack(session)` and new projection must match for facts, FAQ, ordering, IDs, statuses, assistant fields, source URL/excerpt behavior.
- Chat tests: current request shape and only-approved behavior remain unchanged; future source-aware citations reference stable evidence IDs without altering current textual citations until deliberately versioned.
- Property tests: repeated build from identical inputs yields byte-stable normalized memory/fingerprint; source ordering does not affect IDs; duplicate source evidence does not multiply assertions.

## 15. Risks and unresolved decisions

1. **Product decision required:** Is a user correction a new authoritative manual source that supersedes website evidence, or an edit of the original assertion while retaining website support? The code currently does the latter mechanically, but the intended provenance policy is not expressed.
2. **Product decision required:** Is Business Memory scoped one-to-one with an AI Builder project, or may multiple projects represent the same business and share memory? Current ownership is strictly project-scoped (`project_id` everywhere).
3. Decide review semantics for relationship/attribute subparts: one approval for a compound assertion versus independently reviewable entity, price, and relation.
4. Decide source deletion policy: preserve historical evidence with `retracted/superseded`, or hide it from normal reads; never erase audit history by default.
5. Current 32-bit website hash has collision risk and content/URL sensitivity. Preserve it as a legacy adapter before introducing stronger canonical keys.
6. Client-supplied KnowledgePack is accepted by chat API; a later canonical read must address authorization/freshness without changing the public behavior accidentally. `api/ai-builder/chat/route.ts — POST`.

## 16. Exact Business Memory definition of done

Business Memory is complete only when all are demonstrably true:

- Existing approved, corrected, proposed, and archived workflow knowledge is preserved with original IDs and reopens correctly.
- Every imported website fact retains every validated evidence record and source document history; manual and correction sources are distinguishable.
- One assertion may have multiple sources/evidence records; disagreements are represented without overwriting either source.
- Entities, typed attributes, and typed relationships express all seven relationship examples in section 7, including ordered process steps and FAQ support links.
- Canonical build is deterministic/idempotent: same legacy inputs + mapper version produce same semantic IDs/document/fingerprint; retries do not duplicate entities, sources, evidence, or relations.
- A restored old project with only schema-v1 website knowledge works before, during, and after additive migration.
- Review decisions are linked to canonical assertions and survive re-import/rebuild under documented source-change rules.
- The existing `KnowledgePack` contract can be generated equivalently, existing APIs and review UI are unchanged, and demo chat continues to consume only approved/corrected knowledge.
- The model is business-agnostic: custom types/attributes/relationships work without TypeScript contract changes for a new vertical.
- Source revisions, stable keys, conflict representation, and provenance are sufficient for a subsequent Knowledge Sync and Knowledge Merge implementation without redefining canonical identity.
