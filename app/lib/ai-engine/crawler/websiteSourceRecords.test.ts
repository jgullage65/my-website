import assert from "node:assert/strict";
import test from "node:test";
import { buildTextBlocks, locateWebsiteEvidence, normalizeWebsiteSourceBlocks, normalizeWebsiteSourceDocuments, sha256, stableSourceBlockId, stableSourceDocumentId } from "./websiteSourceRecords";

test("source document and block identities are deterministic within an immutable attempt",()=>{
  const hash=sha256("source"),first=stableSourceDocumentId("crawl-1","https://example.test/final",hash);
  assert.equal(first,stableSourceDocumentId("crawl-1","https://example.test/final",hash));
  assert.notEqual(first,stableSourceDocumentId("crawl-2","https://example.test/final",hash));
  const blocks=buildTextBlocks({documentId:first,attemptId:"crawl-1",text:"Price is $20.\nAvailable today.",method:"semantic_html",preserveWhole:true});
  assert.equal(blocks.length,1); assert.equal(blocks[0]?.normalizedText,"Price is $20. Available today.");
  assert.equal(blocks[0]?.id,stableSourceBlockId(first,"paragraph",0,"Price is $20. Available today."));
});

test("PDF blocks preserve page coordinates",()=>{
  const blocks=buildTextBlocks({documentId:"doc",attemptId:"crawl",text:"Page two policy",method:"pdf_text",type:"pdf_page_text",pageNumber:2,preserveWhole:true});
  assert.deepEqual(blocks[0]?.coordinates,{pageNumber:2});
  const document={schemaVersion:1 as const,id:"doc",crawlAttemptId:"crawl",actualFetchedUrl:"https://example.test/menu.pdf?version=1",canonicalUrl:null,redirectChain:[],sourceType:"pdf" as const,contentType:"application/pdf",status:"retained" as const,fetchedAt:"2026-01-01T00:00:00Z",sourceContentHash:"a".repeat(64),extractedContentHash:"b".repeat(64),language:null,sourceTruncated:false,extractionTruncated:false,discoveryMethod:"pdf_link" as const,discoveredFromUrl:"https://example.test/"};
  assert.deepEqual(locateWebsiteEvidence(document.actualFetchedUrl,"Page two policy",[document],blocks,"crawl"),{sourceDocumentId:"doc",crawlAttemptId:"crawl",sourceBlockId:blocks[0]?.id,sourceCoordinates:{pageNumber:2}});
});

test("untrusted source artifacts require a matching attempt, valid hashes, and document-owned coordinates",()=>{
  const document={schemaVersion:1 as const,id:"doc",crawlAttemptId:"crawl",actualFetchedUrl:"https://example.test/final",canonicalUrl:null,redirectChain:[],sourceType:"pdf" as const,contentType:"application/pdf",status:"retained" as const,fetchedAt:"2026-01-01T00:00:00Z",sourceContentHash:"a".repeat(64),extractedContentHash:"b".repeat(64),language:null,sourceTruncated:false,extractionTruncated:false,discoveryMethod:"pdf_link" as const,discoveredFromUrl:null};
  const documents=normalizeWebsiteSourceDocuments([document,{...document,id:"wrong",crawlAttemptId:"another"},{...document,id:"bad-hash",sourceContentHash:"nope"}],"crawl");
  assert.deepEqual(documents.map(item=>item.id),["doc"]);
  const valid={schemaVersion:1 as const,id:"block",sourceDocumentId:"doc",crawlAttemptId:"crawl",type:"pdf_page_text" as const,normalizedText:"Page evidence",coordinates:{pageNumber:2},extractionMethod:"pdf_text" as const};
  const blocks=normalizeWebsiteSourceBlocks([valid,{...valid,id:"other-doc",sourceDocumentId:"missing"},{...valid,id:"missing-page",coordinates:{lineStart:1}}],"crawl",documents);
  assert.deepEqual(blocks.map(item=>item.id),["block"]);
});

test("evidence does not attach a longer excerpt to a short coincidental block",()=>{
  const document={schemaVersion:1 as const,id:"doc",crawlAttemptId:"crawl",actualFetchedUrl:"https://example.test/",canonicalUrl:null,redirectChain:[],sourceType:"html" as const,contentType:"text/html",status:"retained" as const,fetchedAt:"2026-01-01T00:00:00Z",sourceContentHash:"a".repeat(64),extractedContentHash:"b".repeat(64),language:null,sourceTruncated:false,extractionTruncated:false,discoveryMethod:"submitted" as const,discoveredFromUrl:null};
  const blocks=buildTextBlocks({documentId:"doc",attemptId:"crawl",text:"pricing",method:"semantic_html"});
  assert.deepEqual(locateWebsiteEvidence(document.actualFetchedUrl,"Our pricing starts at twenty dollars",[document],blocks,"crawl"),{sourceDocumentId:"doc",crawlAttemptId:"crawl"});
});
