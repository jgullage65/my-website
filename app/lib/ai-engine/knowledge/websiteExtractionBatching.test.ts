import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS,
  AiBuilderInputBatchingError,
  assertSafeWebsiteExtractionInput,
  buildWebsiteExtractionBatches,
  type WebsiteExtractionPage,
} from "./websiteExtractionBatching";

const page = (pageNumber: number, text: string): WebsiteExtractionPage => ({
  pageNumber,
  sourceIdentifier: `source-${pageNumber}`,
  url: `https://example.test/page-${pageNumber}`,
  pageType: "content",
  title: `Page ${pageNumber}`,
  text,
});
const measureWith = (overhead: number) => (input: string) => input.length + overhead;

test("a normal small crawl remains one batch", () => {
  const batches = buildWebsiteExtractionBatches([page(1, "Home"), page(2, "Services")], measureWith(500), 2_000);
  assert.equal(batches.length, 1);
  assert.equal(batches[0]?.units.length, 2);
});

test("pages are added incrementally across several bounded batches", () => {
  const batches = buildWebsiteExtractionBatches([page(1, "a".repeat(600)), page(2, "b".repeat(600)), page(3, "c".repeat(600))], measureWith(100), 900);
  assert.equal(batches.length, 3);
  assert.ok(batches.every((batch) => batch.finalInputCharacterCount <= 900));
});

test("one oversized page is deterministically chunked with provenance and order", () => {
  const batches = buildWebsiteExtractionBatches([page(1, "x".repeat(3_000))], measureWith(100), 700);
  const chunks = batches.flatMap((batch) => batch.units);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((chunk) => chunk.text).join(""), "x".repeat(3_000));
  assert.ok(chunks.every((chunk, index) => chunk.url === "https://example.test/page-1" && chunk.sourceIdentifier === "source-1" && chunk.chunkIndex === index + 1 && chunk.chunkCount === chunks.length));
  assert.ok(batches.every((batch) => batch.finalInputCharacterCount <= 700));
});

test("prompt and schema overhead close a nearly full batch before another page is added", () => {
  const batches = buildWebsiteExtractionBatches([page(1, "a".repeat(500)), page(2, "b".repeat(100))], measureWith(300), 1_000);
  assert.equal(batches.length, 2);
  assert.ok(batches.every((batch) => batch.finalInputCharacterCount <= 1_000));
});

test("a 42,058,813-character crawl is divided without an oversized final input", () => {
  const total = 42_058_813;
  const pages = [0, 1, 2, 3, 4].map((index) => page(index + 1, "z".repeat(index === 4 ? total - 40_000_000 : 10_000_000)));
  const batches = buildWebsiteExtractionBatches(pages, measureWith(5_000));
  assert.ok(batches.length > 5);
  assert.equal(batches.flatMap((batch) => batch.units).reduce((sum, chunk) => sum + chunk.text.length, 0), total);
  assert.ok(batches.every((batch) => batch.finalInputCharacterCount <= AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS));
});

test("the immediate pre-request guard rejects an oversized final input", () => {
  assert.throws(() => assertSafeWebsiteExtractionInput("x", () => AI_BUILDER_MAX_FINAL_INPUT_CHARACTERS + 1), AiBuilderInputBatchingError);
});
