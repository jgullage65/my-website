import assert from "node:assert/strict";
import test from "node:test";
import { WEBSITE_KNOWLEDGE_COVERAGE_FIELDS, type PersistedWebsiteKnowledge, type WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { BusinessMemory } from "../business-memory/contracts";
import { planWebsiteRecrawlExtraction, reconcileWebsiteRecrawl } from "./websiteRecrawlReconciliation";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "./websiteSourceRecords";

const time="2026-07-27T00:00:00.000Z";
const coverage=Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map(field=>[field,0])) as PersistedWebsiteKnowledge["knowledge"]["coverage"];
const document=(attempt:string,id:string,url:string,content:string):WebsiteSourceDocumentRecord=>({schemaVersion:1,id,crawlAttemptId:attempt,actualFetchedUrl:url,canonicalUrl:url,redirectChain:[],sourceType:"html",contentType:"text/html",status:"retained",fetchedAt:time,sourceContentHash:content.padEnd(64,"a").slice(0,64),extractedContentHash:content.padEnd(64,"b").slice(0,64),language:"en",sourceTruncated:false,extractionTruncated:false,discoveryMethod:"html_link",discoveredFromUrl:"https://example.test/"});
const block=(attempt:string,id:string,documentId:string,text:string,line=1):WebsiteSourceBlockRecord=>({schemaVersion:1,id,sourceDocumentId:documentId,crawlAttemptId:attempt,type:"paragraph",normalizedText:text,coordinates:{lineStart:line,lineEnd:line},extractionMethod:"semantic_html"});
const fact=(category:WebsiteKnowledgeFact["category"],title:string,value:string,documentId:string,blockId:string):WebsiteKnowledgeFact=>({category,title,value,confidence:"high",evidence:[{url:"https://example.test/services",excerpt:value,sourceDocumentId:documentId,sourceBlockId:blockId,crawlAttemptId:documentId.startsWith("old")?"crawl-old":"crawl-new"}]});
const knowledge=(attempt:string,documents:WebsiteSourceDocumentRecord[],blocks:WebsiteSourceBlockRecord[],facts:WebsiteKnowledgeFact[]):PersistedWebsiteKnowledge=>({schema_version:2,document_version:1,current_crawl_attempt_id:attempt,imported_at:time,requested_url:"https://example.test/",resolved_url:"https://example.test/",pages:[],warnings:[],knowledge:{facts,coverage,unresolvedQuestions:[]},source_documents:documents,source_blocks:blocks});

function correctionMemory():BusinessMemory{return {id:"memory",schemaVersion:1,projectId:"project",assistant:{name:"A",purpose:"P",tone:"T",responseStyle:"S",primaryAudience:null,escalationInstructions:[]},entities:[{id:"entity-service",type:"service",name:"Website Design",aliases:[],tags:[],assertionIds:["human-correction"],sourceIds:["user-edit-source"],evidenceIds:["website-evidence"],createdAt:time,updatedAt:time}],assertions:[{id:"human-correction",entityId:"entity-service",value:"Human-reviewed premium design",confidence:{level:"high",score:.9},reviewState:"corrected",authority:"corrected",sourceIds:["user-edit-source"],evidenceIds:["website-evidence"],tags:["service"],legacyEntryId:null,predecessorAssertionId:"website-assertion-old",provenance:{classification:"user_corrected",predecessorClassification:"website",originalClassification:"website",correctedByClerkUserId:"user",correctedByDisplayName:null,correctedByEmail:null,correctedAt:time},createdAt:time,updatedAt:time}],relationships:[],sources:[{id:"user-edit-source",origin:"user_edit",sourceEntryId:null,intakeBlockId:"website_knowledge",url:"https://example.test/services",label:null,capturedAt:time,crawlAttemptId:"crawl-old",sourceDocumentId:"old-home"}],evidence:[{id:"website-evidence",sourceId:"user-edit-source",excerpt:"Old design",url:"https://example.test/services",capturedAt:time,sourceBlockId:"old-home-block"}],conflicts:[],missingInformation:[],createdAt:time,updatedAt:time};}

test("deterministically reconciles source, block, fact, removal, conflict, correction, and lineage changes",()=>{
  const oldHome=document("crawl-old","old-home","https://example.test/services","1"),oldRemoved=document("crawl-old","old-removed","https://example.test/policy","2"),oldStable=document("crawl-old","old-stable","https://example.test/contact","3");
  const newHome=document("crawl-new","new-home","https://example.test/services","4"),newAdded=document("crawl-new","new-added","https://example.test/about","5"),newStable=document("crawl-new","new-stable","https://example.test/contact","3");
  const previous=knowledge("crawl-old",[oldHome,oldRemoved,oldStable],[block("crawl-old","old-home-block",oldHome.id,"Old design"),block("crawl-old","old-policy-block",oldRemoved.id,"No refunds"),block("crawl-old","old-stable-block",oldStable.id,"Call us")],[fact("service","Website Design","Old design",oldHome.id,"old-home-block"),fact("policy","Refunds","No refunds",oldRemoved.id,"old-policy-block")]);
  const currentFacts=[fact("service","Website Design","New automated design",newHome.id,"new-home-block"),fact("pricing","Plans","Starter is $20",newHome.id,"new-home-block"),fact("pricing","Plans","Starter is $30",newHome.id,"new-home-block"),fact("other","Untraceable","Unknown", "missing-document","missing-block")];
  const current=knowledge("crawl-new",[newHome,newAdded,newStable],[block("crawl-new","new-home-block",newHome.id,"New automated design"),block("crawl-new","new-added-block",newAdded.id,"About us"),block("crawl-new","new-stable-block",newStable.id,"Call us")],currentFacts);
  const result=reconcileWebsiteRecrawl({previous,current,businessMemory:correctionMemory()});
  assert.ok(result.sourceChanges.some(change=>change.state==="changed"&&change.previousVersionId==="old-home"&&change.currentVersionId==="new-home"));
  assert.ok(result.sourceChanges.some(change=>change.state==="removed"&&change.previousVersionId==="old-removed"));
  assert.ok(result.sourceChanges.some(change=>change.state==="added"&&change.currentVersionId==="new-added"));
  assert.ok(result.sourceChanges.some(change=>change.state==="unchanged"&&change.previousVersionId==="old-stable"&&change.currentVersionId==="new-stable"));
  assert.ok(result.blockChanges.some(change=>change.state==="changed"&&change.previousVersionId==="old-home-block"&&change.currentVersionId==="new-home-block"));
  assert.ok(result.factChanges.some(change=>change.state==="changed"));assert.ok(result.factChanges.some(change=>change.state==="removed"));
  assert.deepEqual(result.removals.sourceDocumentIds,["old-removed"]);assert.deepEqual(result.removals.sourceBlockIds,["old-policy-block"]);assert.equal(result.removals.factVersionIds.length,1);
  assert.equal(result.removals.authoritative,false);
  assert.ok(result.staleEvidence.some(item=>item.reason==="missing_document"&&item.sourceDocumentId==="missing-document"));
  assert.ok(result.conflicts.some(conflict=>conflict.kind==="website_values"&&conflict.statements.length===2));
  assert.ok(result.conflicts.some(conflict=>conflict.kind==="preserved_human_correction"&&conflict.preservedAssertionIds.includes("human-correction")));
  assert.deepEqual(result.preservedHumanCorrections.map(item=>item.assertionId),["human-correction"]);assert.equal(result.preservedHumanCorrections[0]?.predecessorAssertionId,"website-assertion-old");
  assert.ok(result.predecessorLineage.some(item=>item.kind==="fact"));
  const reordered=reconcileWebsiteRecrawl({previous:{...previous,source_documents:[...previous.source_documents!].reverse(),source_blocks:[...previous.source_blocks!].reverse(),knowledge:{...previous.knowledge,facts:[...previous.knowledge.facts].reverse()}},current:{...current,source_documents:[...current.source_documents!].reverse(),source_blocks:[...current.source_blocks!].reverse(),knowledge:{...current.knowledge,facts:[...current.knowledge.facts].reverse()}},businessMemory:correctionMemory()});
  assert.deepEqual(reordered,result);
});

test("requires two distinct immutable crawl attempts",()=>{const empty=knowledge("same",[],[],[]);assert.throws(()=>reconcileWebsiteRecrawl({previous:empty,current:empty}),/distinct_attempts/);});

test("only treats removals as authoritative when an unrestricted completed attempt is explicitly approved",()=>{const previous=knowledge("old",[],[],[fact("policy","Returns","Thirty days","old-doc","old-block")]),current=knowledge("new",[],[],[]);const attempt={schemaVersion:1 as const,id:"new",requestedUrl:"https://example.test/",normalizedSubmittedUrl:"https://example.test/",resolvedEntryUrl:"https://example.test/",startedAt:time,completedAt:time,crawlerVersion:"test",extractionVersion:"test",status:"completed" as const,budgets:{pages:1},restrictions:[]};assert.equal(reconcileWebsiteRecrawl({previous,current,currentCrawlAttempt:attempt}).removals.authoritative,false);assert.equal(reconcileWebsiteRecrawl({previous,current,currentCrawlAttempt:attempt,authorizeRemovals:true}).removals.authoritative,true);assert.equal(reconcileWebsiteRecrawl({previous,current,currentCrawlAttempt:{...attempt,status:"partial",restrictions:[{type:"timeout",url:"https://example.test/"}]},authorizeRemovals:true}).removals.authoritative,false);assert.throws(()=>reconcileWebsiteRecrawl({previous,current,currentCrawlAttempt:{...attempt,id:"other"}}),/attempt_mismatch/);});

test("plans full initial extraction and zero-call unchanged recrawls",()=>{
  const oldDoc=document("crawl-old","old-doc","https://example.test/services","same"),newDoc=document("crawl-new","new-doc","https://example.test/services","same");
  const oldBlock=block("crawl-old","old-block",oldDoc.id,"Stable service"),newBlock=block("crawl-new","new-block",newDoc.id,"Stable service");
  const current=knowledge("crawl-new",[newDoc],[newBlock],[]);
  assert.deepEqual(planWebsiteRecrawlExtraction({current}).extractionBlocks.map(item=>item.id),["new-block"]);
  const plan=planWebsiteRecrawlExtraction({previous:knowledge("crawl-old",[oldDoc],[oldBlock],[fact("service","Stable","Stable service",oldDoc.id,oldBlock.id)]),current});
  assert.equal(plan.mode,"recrawl");assert.equal(plan.telemetry.blocksSentToLlm,0);assert.equal(plan.telemetry.blocksSkippedUnchanged,1);assert.equal(plan.preservedFacts.length,1);
  assert.equal(plan.preservedFacts[0]!.evidence[0]!.sourceBlockId,"new-block");assert.equal(plan.preservedFacts[0]!.evidence[0]!.crawlAttemptId,"crawl-new");
  const reconciled=reconcileWebsiteRecrawl({previous:knowledge("crawl-old",[oldDoc],[oldBlock],[fact("service","Stable","Stable service",oldDoc.id,oldBlock.id)]),current:{...current,knowledge:{...current.knowledge,facts:plan.preservedFacts}}});
  assert.equal(reconciled.factChanges[0]!.state,"unchanged");assert.equal(reconciled.factChanges.filter(change=>change.state!=="unchanged").length,0);
});

test("extracts only added and changed blocks and is order-independent",()=>{
  const oldA=document("crawl-old","old-a","https://example.test/a","one"),oldB=document("crawl-old","old-b","https://example.test/b","two"),oldRemoved=document("crawl-old","old-r","https://example.test/r","gone");
  const newA=document("crawl-new","new-a","https://example.test/a","changed"),newB=document("crawl-new","new-b","https://example.test/b","two"),newAdded=document("crawl-new","new-c","https://example.test/c","added");
  const previous=knowledge("crawl-old",[oldA,oldB,oldRemoved],[block("crawl-old","old-ab",oldA.id,"Before"),block("crawl-old","old-bb",oldB.id,"Stable"),block("crawl-old","old-rb",oldRemoved.id,"Gone")],[]);
  const current=knowledge("crawl-new",[newA,newB,newAdded],[block("crawl-new","new-ab",newA.id,"After"),block("crawl-new","new-bb",newB.id,"Stable"),block("crawl-new","new-cb",newAdded.id,"Added")],[]);
  const plan=planWebsiteRecrawlExtraction({previous,current});
  assert.deepEqual(plan.extractionBlocks.map(item=>item.id).sort(),["new-ab","new-cb"]);assert.equal(plan.telemetry.unchangedBlocks,1);assert.equal(plan.telemetry.removedBlocks,1);
  const reordered=planWebsiteRecrawlExtraction({previous:{...previous,source_documents:[...previous.source_documents!].reverse(),source_blocks:[...previous.source_blocks!].reverse()},current:{...current,source_documents:[...current.source_documents!].reverse(),source_blocks:[...current.source_blocks!].reverse()}});
  assert.deepEqual(reordered.blockChanges,plan.blockChanges);assert.deepEqual(reordered.extractionBlocks.map(item=>item.id).sort(),plan.extractionBlocks.map(item=>item.id).sort());
});
