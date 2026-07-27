import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWebsiteKnowledge } from "@/app/lib/db/ai-builder-repository";
import { WEBSITE_KNOWLEDGE_COVERAGE_FIELDS } from "./websiteKnowledge";

test("continues to read schema-version-one Website Knowledge",()=>{
  const coverage=Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map(field=>[field,field==="overall"?10:0]));
  const legacy={schema_version:1,document_version:1,current_crawl_attempt_id:"legacy",imported_at:"2026-01-01T00:00:00Z",requested_url:"https://example.test",resolved_url:"https://example.test",pages:[],warnings:[],knowledge:{facts:[{category:"service",title:"Planning",value:"Planning is available.",confidence:"high",evidence:[{url:"https://example.test/services",excerpt:"Planning is available."}]}],coverage,unresolvedQuestions:[]}};
  const normalized=normalizeWebsiteKnowledge(legacy);
  assert.equal(normalized?.schema_version,1);
  assert.deepEqual(normalized?.knowledge.facts[0]?.evidence,[{url:"https://example.test/services",excerpt:"Planning is available."}]);
});
