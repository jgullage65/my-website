# Business Memory End-to-End Architecture Audit

## Scope and conclusion

This audit examines the actual isolated contracts, mapper, and Node tests in `app/lib/ai-engine/business-memory`. The mapper is pure and has no production consumer. **No BLOCKING finding exists:** every currently representable AI Builder context entry, FAQ, website fact, source URL, evidence excerpt, confidence value, and workflow status has a destination in the output. The categories below use exactly one classification per finding.

## Provenance shadow boundary

The existing canonical provenance shadow tables are an **audit, provenance, and governance-history layer**. During the current migration stage, legacy AI Builder persistence remains authoritative. The provenance shadow is not the persistence model for the new canonical `BusinessMemory`, and its current writes must not be read as a canonical Business Memory cutover or runtime integration.

Initial provenance-shadow writes are non-authoritative: they may fail without breaking the already-committed legacy project save. In contrast, governance/review shadow writes are intentionally atomic with their matching legacy review mutations so that each legacy review decision and its governance history succeed or fail together. Neither behavior makes the shadow the source of truth for project loading, review, chat, retrieval, or any other runtime path.

Future Business Memory persistence will be designed separately for canonical entities, assertions, relationships, conflicts, missing information, assistant configuration, and the other `BusinessMemory` structures. The deterministic mapper assessed below is therefore a read-only projection and validation boundary, not evidence that the provenance tables already provide complete Business Memory persistence.

## Lifecycle

```text
AiBuilderSession + PersistedWebsiteKnowledge
  -> context / FAQ / website legacy assertion normalization
  -> deterministic entity ID from project + mapped type + normalized name
  -> independent BusinessAssertion and source/evidence IDs
  -> grouped BusinessEntity metadata and display aliases
  -> direct FAQ supports relationships
  -> canonically sorted BusinessMemory
```

The input flow is implemented by `contextAssertion`, `faqAssertion`, and `websiteAssertions`; the projection is assembled by `buildBusinessMemory`. `buildBusinessMemory.ts — lines 87-218`.

## Object audit

| Object | Responsibility and why it exists | Identity/provenance/timestamps/data classification | Finding |
|---|---|---|---|
| `BusinessMemory` | Root project-scoped projection containing all canonical collections. It avoids duplicating entity, source, or evidence responsibilities. | ID is derived only from project ID; root timestamps are copied from the session and are therefore projection input metadata. Its collections are derived projections. It represents all mapped inputs. | **VALIDATED** — root scope and contents are explicit. `contracts.ts — BusinessMemory`; `buildBusinessMemory.ts — 212-217`. |
| `BusinessEntity` | Canonical named concept grouping independent claims. It does not duplicate assertion-level authority, confidence, or review state. | ID uses project/type/normalized name, not content/source/status/time/legacy ID. Aggregate source/evidence/tag/alias IDs and min/max timestamps are derived; name/aliases are deterministic display projections. | **VALIDATED** — grouping is correctly scoped. `buildBusinessMemory.ts — 160-163, 183-198`. |
| `BusinessAssertion` | One traceable legacy claim, preserving value, confidence, review state, authority, provenance links, tags, legacy ID, and timestamps. | ID uses project, kind, and stable legacy identity; its data is canonical projection data. Website facts have no legacy workflow row and correctly use `null`. | **VALIDATED** — no duplicate-value or archived claim is discarded. `contracts.ts — BusinessAssertion`; `buildBusinessMemory.ts — 163-180`. |
| `KnowledgeSource` | Provenance origin and locator for an assertion. It does not encode authority. | ID includes project, assertion ID, origin, legacy/source block IDs, and URL; URL is retained per evidence URL. `capturedAt` comes from entry creation/import time. | **VALIDATED** — origin is separate from authority. `contracts.ts — KnowledgeSourceOrigin`, `KnowledgeSource`; `buildBusinessMemory.ts — 168-177`. |
| `EvidenceRecord` | Immutable excerpt-to-source link, including every website excerpt. | ID derives from source and normalized excerpt; captured time is the legacy assertion creation/import time. It is a derived normalized record but no input excerpt/URL is dropped. | **VALIDATED** — multi-evidence facts produce multiple records. `contracts.ts — EvidenceRecord`; `buildBusinessMemory.ts — 173-178`. |
| `BusinessRelationship` | Represents only explicit FAQ `sourceEntryIds` as `supports` links. | ID includes endpoints and both referenced legacy IDs. Timestamps/review state come from the FAQ; source entry IDs remain traceable. | **VALIDATED** — no unsupported relationship is inferred. `buildBusinessMemory.ts — 200-210`. |
| `Confidence` | Keeps legacy confidence label and score together at assertion level. | It has no identity, provenance, or timestamp because it is a value object; no score conversion occurs for context/FAQ. Website scores are the pre-existing deterministic high/medium/low mapping. | **VALIDATED** — confidence is not authority. `contracts.ts — Confidence`; `buildBusinessMemory.ts — 91-92, 103, 126`. |
| `ReviewState` | Preserves workflow `proposed`, `approved`, `corrected`, and `archived` without filtering. | It is a canonical copied workflow value on each assertion and relationship. | **VALIDATED** — archived and corrected remain visible. `contracts.ts — ReviewState`; tests `buildBusinessMemory.test.ts — duplicate-state test`. |
| `AssertionAuthority` | Separately records observed/provided/generated/confirmed/corrected interpretation. | Derived deterministically from source origin, edit flag, and corrected status; it neither changes entity identity nor replaces review state. | **VALIDATED** — required source/authority matrix is implemented. `contracts.ts — AssertionAuthority`; `buildBusinessMemory.ts — 87-130`. |

## Determinism and canonical sorting

`stableId` normalizes whitespace and case before hashing. Entities use only project/type/name. Assertions use stable legacy identities; website facts first compute a sorted fingerprint and deterministic occurrence number, so website input ordering does not alter IDs. Collections are sorted by ID; tags/source IDs/evidence IDs are sorted and unique. `buildBusinessMemory.ts — 43-67, 109-145, 212-216`.

**VALIDATED** — reordered context entries and reordered website facts serialize byte-equivalently in the test suite. `buildBusinessMemory.test.ts — deterministic-output test`.

## Category and FAQ mapping

Context categories map to business, customer segment, service, pricing concept, policy, process, differentiator, FAQ, or other. Website categories map to the corresponding entity types, including product, guarantee, location, and contact method. These mappings are necessary adapters to existing flat categories and do not create relationships. `buildBusinessMemory.ts — 69-85`.

Generated FAQ questions map to FAQ entities; their answers are independent assertions. Only source IDs that resolve to existing mapped context entities generate supports links, and several source rows that group to one canonical entity still target that entity. `buildBusinessMemory.ts — 99-106, 200-210`.

**VALIDATED** — category mappings are current-workflow adapters, not unnecessary domain duplication; FAQ relationships remain explicit.

## Alias and display-name audit

`aggregateAliases` normalizes whitespace, keys aliases case-insensitively, removes empty values, selects a display form by origin/review priority, and uses lexical ordering as a tie-breaker. `preferredName` applies the identical priority to the canonical entity name. `buildBusinessMemory.ts — 135-159`.

**VALIDATED** — capitalization/whitespace variants produce one alias; semantic aliases remain separate; corrected user-edit values outrank approved manual values; results do not depend on input ordering. `buildBusinessMemory.test.ts — alias tests`.

## Explicit losslessness verification

| Verification | Finding |
|---|---|
| Context entry, FAQ, and website fact preservation | **VALIDATED** — each normalization emits one legacy assertion and each becomes one BusinessAssertion. |
| Evidence excerpts and source URLs | **VALIDATED** — each website evidence item creates a source/evidence pair; tests assert all excerpts. |
| Confidence and workflow state | **VALIDATED** — copied unchanged to assertions; review state is not filtered. |
| Duplicate facts | **VALIDATED** — assertion IDs are legacy-identity based, so equal values remain separately traceable. |
| Corrected vs observed | **VALIDATED** — corrected authority is distinct from website observed authority while review state remains present. |
| Timestamp semantics | **VALIDATED** — assertion timestamps copy input timestamps; entity timestamps are earliest/latest aggregates. |
| Workflow assumptions | **VALIDATED** — `sourceEntryId`, `intakeBlockId`, and FAQ support references are required adapters for current AI Builder provenance, not duplicate concepts. |

## Complexity and test classification

**UNNECESSARY COMPLEXITY** — none identified. Each collection has a non-overlapping responsibility: concepts, claims, provenance locations, excerpts, and explicit links.

**TEST GAP** — none identified for the stated mapper behavior. The isolated tests cover empty, manual-only, website-only, FAQ-only, mixed, duplicate, archived, corrected, source/authority, aliases, evidence, FAQ links, and reordered input. `buildBusinessMemory.test.ts`.

## Blocking findings

**BLOCKING** — none. Current AI Builder data has a lossless, deterministic path through the model: every row-backed entry has its legacy ID, every website evidence item has its URL/excerpt source chain, and no mapper branch discards an assertion based on status, confidence, or duplicate content.
