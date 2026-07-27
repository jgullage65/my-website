import { createHash } from "node:crypto";
import type { BusinessMemory } from "../business-memory/contracts";
import type { PersistedWebsiteKnowledge, WebsiteKnowledgeEvidence, WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { WebsiteCrawlAttemptRecord, WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "./websiteSourceRecords";

export const WEBSITE_RECRAWL_RECONCILIATION_SCHEMA_VERSION = 1 as const;
export type WebsiteRecrawlChangeState = "added" | "changed" | "unchanged" | "removed";
export type WebsiteRecrawlItemKind = "source_document" | "source_block" | "fact";

export type WebsiteRecrawlChange = {
  kind: WebsiteRecrawlItemKind;
  logicalId: string;
  state: WebsiteRecrawlChangeState;
  previousVersionId: string | null;
  currentVersionId: string | null;
  previousHash: string | null;
  currentHash: string | null;
};

export type WebsiteRecrawlStaleEvidence = {
  factVersionId: string;
  evidenceIndex: number;
  sourceDocumentId: string | null;
  sourceBlockId: string | null;
  reason: "missing_document" | "missing_block" | "document_removed" | "block_removed" | "fact_removed" | "fact_changed";
};

export type WebsiteRecrawlConflict = {
  id: string;
  logicalFactId: string;
  kind: "website_values" | "preserved_human_correction";
  currentFactVersionIds: string[];
  preservedAssertionIds: string[];
  statements: string[];
};

export type PreservedWebsiteCorrection = {
  assertionId: string;
  entityId: string;
  value: string;
  predecessorAssertionId: string | null;
  sourceIds: string[];
  evidenceIds: string[];
};

export type WebsiteRecrawlLineage = {
  kind: WebsiteRecrawlItemKind;
  logicalId: string;
  predecessorVersionId: string;
  successorVersionId: string;
};

export type WebsiteFactVersion = {
  id: string;
  crawlAttemptId: string;
  logicalId: string;
  hash: string;
  fact: WebsiteKnowledgeFact;
};

export type WebsiteRecrawlReconciliation = {
  schemaVersion: typeof WEBSITE_RECRAWL_RECONCILIATION_SCHEMA_VERSION;
  previousCrawlAttemptId: string;
  currentCrawlAttemptId: string;
  sourceChanges: WebsiteRecrawlChange[];
  blockChanges: WebsiteRecrawlChange[];
  factChanges: WebsiteRecrawlChange[];
  factVersions: WebsiteFactVersion[];
  staleEvidence: WebsiteRecrawlStaleEvidence[];
  removals: { authoritative:boolean;reason:"complete_crawl"|"incomplete_or_unverified_crawl";sourceDocumentIds: string[]; sourceBlockIds: string[]; factVersionIds: string[] };
  conflicts: WebsiteRecrawlConflict[];
  preservedHumanCorrections: PreservedWebsiteCorrection[];
  predecessorLineage: WebsiteRecrawlLineage[];
  fingerprint: string;
};

type VersionedItem = { versionId:string;hash:string };
type LogicalItem = VersionedItem & { logicalBase:string };

const normalized=(value:unknown)=>String(value??"").replace(/\s+/g," ").trim().toLowerCase();
const compare=(left:string,right:string)=>left<right?-1:left>right?1:0;
const sortedUnique=(values:readonly string[])=>Array.from(new Set(values.filter(Boolean))).sort(compare);
export function canonicalWebsiteRecrawlJson(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonicalWebsiteRecrawlJson).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value as Record<string,unknown>).filter(([,item])=>item!==undefined).sort(([left],[right])=>compare(left,right)).map(([key,item])=>`${JSON.stringify(key)}:${canonicalWebsiteRecrawlJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash=(value:unknown)=>createHash("sha256").update(typeof value==="string"?value:canonicalWebsiteRecrawlJson(value)).digest("hex");
const stableId=(prefix:string,...values:string[])=>`${prefix}_${hash(values.map(normalized).join("\0"))}`;
const comparableUrl=(value:string)=>{try{const url=new URL(value);url.hash="";url.hostname=url.hostname.toLowerCase();if(url.pathname!=="/")url.pathname=url.pathname.replace(/\/+$/g,"");return url.toString();}catch{return normalized(value);}};
const coordinates=(block:WebsiteSourceBlockRecord)=>canonicalWebsiteRecrawlJson(block.coordinates);
const factMaterial=(fact:WebsiteKnowledgeFact)=>({category:fact.category,title:normalized(fact.title),value:normalized(fact.value),confidence:fact.confidence,evidence:fact.evidence.map(evidence=>({url:comparableUrl(evidence.url),excerpt:normalized(evidence.excerpt),sourceDocumentId:evidence.sourceDocumentId??null,sourceBlockId:evidence.sourceBlockId??null})).sort((a,b)=>compare(canonicalWebsiteRecrawlJson(a),canonicalWebsiteRecrawlJson(b)))});

function group<T extends LogicalItem>(items:readonly T[]):Map<string,T[]> {
  const result=new Map<string,T[]>();
  for(const item of items)result.set(item.logicalBase,[...(result.get(item.logicalBase)??[]),item]);
  for(const values of Array.from(result.values()))values.sort((left:T,right:T)=>compare(`${left.hash}\0${left.versionId}`,`${right.hash}\0${right.versionId}`));
  return result;
}

function compareItems(kind:WebsiteRecrawlItemKind,previous:readonly LogicalItem[],current:readonly LogicalItem[]):WebsiteRecrawlChange[]{
  const before=group(previous),after=group(current),changes:WebsiteRecrawlChange[]=[];
  for(const logicalBase of sortedUnique([...Array.from(before.keys()),...Array.from(after.keys())])){
    const oldItems=[...(before.get(logicalBase)??[])],newItems=[...(after.get(logicalBase)??[])];
    const matchedOld=new Set<number>(),matchedNew=new Set<number>(),exactPairs:Array<{old:LogicalItem;current:LogicalItem;oldIndex:number}>=[];
    for(let currentIndex=0;currentIndex<newItems.length;currentIndex+=1){const previousIndex=oldItems.findIndex((item,index)=>!matchedOld.has(index)&&item.hash===newItems[currentIndex]!.hash);if(previousIndex>=0){matchedOld.add(previousIndex);matchedNew.add(currentIndex);exactPairs.push({old:oldItems[previousIndex]!,current:newItems[currentIndex]!,oldIndex:previousIndex});}}
    const remainingOld=oldItems.map((item,index)=>({item,index})).filter(({index})=>!matchedOld.has(index));
    const remainingNew=newItems.map((item,index)=>({item,index})).filter(({index})=>!matchedNew.has(index));
    for(const pair of exactPairs)changes.push({kind,logicalId:stableId(`${kind}_logical`,logicalBase,String(pair.oldIndex)),state:"unchanged",previousVersionId:pair.old.versionId,currentVersionId:pair.current.versionId,previousHash:pair.old.hash,currentHash:pair.current.hash});
    for(let index=0;index<Math.max(remainingOld.length,remainingNew.length);index+=1){const old=remainingOld[index],currentItem=remainingNew[index]?.item;const slot=old?.index??oldItems.length+index;changes.push({kind,logicalId:stableId(`${kind}_logical`,logicalBase,String(slot)),state:old&&currentItem?"changed":old?"removed":"added",previousVersionId:old?.item.versionId??null,currentVersionId:currentItem?.versionId??null,previousHash:old?.item.hash??null,currentHash:currentItem?.hash??null});}
  }
  return changes.sort((left,right)=>compare(`${left.logicalId}\0${left.state}`,`${right.logicalId}\0${right.state}`));
}

function documents(knowledge:PersistedWebsiteKnowledge):Array<LogicalItem&{record:WebsiteSourceDocumentRecord}>{
  return (knowledge.source_documents??[]).map(record=>({record,logicalBase:comparableUrl(record.canonicalUrl??record.actualFetchedUrl),versionId:record.id,hash:hash({sourceType:record.sourceType,sourceContentHash:record.sourceContentHash,extractedContentHash:record.extractedContentHash,language:record.language,sourceTruncated:record.sourceTruncated,extractionTruncated:record.extractionTruncated})}));
}
function blocks(knowledge:PersistedWebsiteKnowledge,documentLogicalById:Map<string,string>):Array<LogicalItem&{record:WebsiteSourceBlockRecord}>{
  return (knowledge.source_blocks??[]).flatMap(record=>{const document=documentLogicalById.get(record.sourceDocumentId);return document?[{record,logicalBase:`${document}\0${record.type}\0${record.extractionMethod}\0${coordinates(record)}`,versionId:record.id,hash:hash(normalized(record.normalizedText))}]:[];});
}
function facts(knowledge:PersistedWebsiteKnowledge):Array<LogicalItem&{fact:WebsiteKnowledgeFact;index:number}>{
  const occurrences=new Map<string,number>();
  return knowledge.knowledge.facts.map(fact=>({fact,logicalBase:`${fact.category}\0${normalized(fact.title)}`,hash:hash(factMaterial(fact))})).sort((left,right)=>compare(`${left.logicalBase}\0${left.hash}\0${canonicalWebsiteRecrawlJson(factMaterial(left.fact))}`,`${right.logicalBase}\0${right.hash}\0${canonicalWebsiteRecrawlJson(factMaterial(right.fact))}`)).map(item=>{const key=`${item.logicalBase}\0${item.hash}`,index=occurrences.get(key)??0;occurrences.set(key,index+1);return {...item,index,versionId:stableId("website_fact_version",knowledge.current_crawl_attempt_id??"",item.hash,String(index))};});
}

function correctionRecords(memory:BusinessMemory|undefined):PreservedWebsiteCorrection[]{
  if(!memory)return [];
  const websiteSourceIds=new Set(memory.sources.filter(source=>source.origin==="website").map(source=>source.id));
  return memory.assertions.filter(assertion=>(assertion.authority==="corrected"||assertion.provenance?.classification==="user_corrected")&&(assertion.sourceIds.some(id=>websiteSourceIds.has(id))||assertion.provenance?.predecessorClassification==="website"||assertion.provenance?.originalClassification==="website")).map(assertion=>({assertionId:assertion.id,entityId:assertion.entityId,value:assertion.value,predecessorAssertionId:assertion.predecessorAssertionId??null,sourceIds:sortedUnique(assertion.sourceIds),evidenceIds:sortedUnique(assertion.evidenceIds)})).sort((left,right)=>compare(left.assertionId,right.assertionId));
}

export function reconcileWebsiteRecrawl(input:{previous:PersistedWebsiteKnowledge;current:PersistedWebsiteKnowledge;currentCrawlAttempt?:WebsiteCrawlAttemptRecord;authorizeRemovals?:boolean;businessMemory?:BusinessMemory}):WebsiteRecrawlReconciliation{
  const previousAttempt=input.previous.current_crawl_attempt_id,currentAttempt=input.current.current_crawl_attempt_id;
  if(!previousAttempt||!currentAttempt||previousAttempt===currentAttempt)throw new Error("website_recrawl_requires_distinct_attempts");
  if(input.currentCrawlAttempt&&input.currentCrawlAttempt.id!==currentAttempt)throw new Error("website_recrawl_attempt_mismatch");
  const previousDocuments=documents(input.previous),currentDocuments=documents(input.current);
  const previousDocumentLogical=new Map(previousDocuments.map(item=>[item.record.id,item.logicalBase])),currentDocumentLogical=new Map(currentDocuments.map(item=>[item.record.id,item.logicalBase]));
  const previousBlocks=blocks(input.previous,previousDocumentLogical),currentBlocks=blocks(input.current,currentDocumentLogical);
  const previousFacts=facts(input.previous),currentFacts=facts(input.current);
  const sourceChanges=compareItems("source_document",previousDocuments,currentDocuments),blockChanges=compareItems("source_block",previousBlocks,currentBlocks),factChanges=compareItems("fact",previousFacts,currentFacts);
  const factLogicalIds=new Map(factChanges.flatMap(change=>[[change.previousVersionId,change.logicalId] as const,[change.currentVersionId,change.logicalId] as const]).filter((entry):entry is [string,string]=>Boolean(entry[0])));
  const factVersions=[...previousFacts.map(item=>({id:item.versionId,crawlAttemptId:previousAttempt,logicalId:factLogicalIds.get(item.versionId)!,hash:item.hash,fact:item.fact})),...currentFacts.map(item=>({id:item.versionId,crawlAttemptId:currentAttempt,logicalId:factLogicalIds.get(item.versionId)!,hash:item.hash,fact:item.fact}))].sort((left,right)=>compare(left.id,right.id));
  const currentDocumentIds=new Set(currentDocuments.map(item=>item.record.id)),currentBlocksById=new Map(currentBlocks.map(item=>[item.record.id,item.record]));
  const staleDocumentIds=new Set(sourceChanges.filter(change=>change.state==="removed"||change.state==="changed").map(change=>change.previousVersionId).filter((id):id is string=>!!id));
  const staleBlockIds=new Set(blockChanges.filter(change=>change.state==="removed"||change.state==="changed").map(change=>change.previousVersionId).filter((id):id is string=>!!id));
  const staleEvidence:WebsiteRecrawlStaleEvidence[]=[];
  const inspectEvidence=(factVersionId:string,evidence:WebsiteKnowledgeEvidence,index:number,priorState?:"removed"|"changed")=>{const documentId=evidence.sourceDocumentId??null,blockId=evidence.sourceBlockId??null;if(documentId&&(priorState?staleDocumentIds.has(documentId):!currentDocumentIds.has(documentId)))staleEvidence.push({factVersionId,evidenceIndex:index,sourceDocumentId:documentId,sourceBlockId:blockId,reason:priorState?"document_removed":"missing_document"});else if(blockId&&(priorState?staleBlockIds.has(blockId):!currentBlocksById.has(blockId)||currentBlocksById.get(blockId)?.sourceDocumentId!==documentId))staleEvidence.push({factVersionId,evidenceIndex:index,sourceDocumentId:documentId,sourceBlockId:blockId,reason:priorState?"block_removed":"missing_block"});else if(priorState)staleEvidence.push({factVersionId,evidenceIndex:index,sourceDocumentId:documentId,sourceBlockId:blockId,reason:priorState==="removed"?"fact_removed":"fact_changed"});};
  for(const item of previousFacts){const change=factChanges.find(candidate=>(candidate.state==="removed"||candidate.state==="changed")&&candidate.previousVersionId===item.versionId);if(change)item.fact.evidence.forEach((evidence,index)=>inspectEvidence(item.versionId,evidence,index,change.state as "removed"|"changed"));}
  for(const item of currentFacts)item.fact.evidence.forEach((evidence,index)=>inspectEvidence(item.versionId,evidence,index));
  staleEvidence.sort((left,right)=>compare(`${left.factVersionId}\0${left.evidenceIndex}\0${left.reason}`,`${right.factVersionId}\0${right.evidenceIndex}\0${right.reason}`));
  const preservedHumanCorrections=correctionRecords(input.businessMemory),entityNames=new Map(input.businessMemory?.entities.map(entity=>[entity.id,normalized(entity.name)])??[]);
  const conflicts:WebsiteRecrawlConflict[]=[];
  for(const [logicalBase,items] of Array.from(group(currentFacts).entries())){
    const statements=sortedUnique(items.map(item=>normalized(item.fact.value)));const logicalFactId=stableId("fact_logical",logicalBase,"0");
    if(statements.length>1)conflicts.push({id:stableId("website_recrawl_conflict",logicalFactId,"website_values",...statements),logicalFactId,kind:"website_values",currentFactVersionIds:items.map(item=>item.versionId).sort(compare),preservedAssertionIds:[],statements});
    const [category,title]=logicalBase.split("\0");const corrections=preservedHumanCorrections.filter(correction=>entityNames.get(correction.entityId)===title&&input.businessMemory?.assertions.find(assertion=>assertion.id===correction.assertionId)?.tags.includes(category!));
    const correctionStatements=sortedUnique(corrections.map(correction=>normalized(correction.value)));if(corrections.length&&correctionStatements.some(value=>!statements.includes(value)))conflicts.push({id:stableId("website_recrawl_conflict",logicalFactId,"preserved_human_correction",...statements,...correctionStatements),logicalFactId,kind:"preserved_human_correction",currentFactVersionIds:items.map(item=>item.versionId).sort(compare),preservedAssertionIds:corrections.map(item=>item.assertionId).sort(compare),statements:sortedUnique([...statements,...correctionStatements])});
  }
  conflicts.sort((left,right)=>compare(left.id,right.id));
  const predecessorLineage=[...sourceChanges,...blockChanges,...factChanges].filter(change=>change.state==="changed"&&change.previousVersionId&&change.currentVersionId).map(change=>({kind:change.kind,logicalId:change.logicalId,predecessorVersionId:change.previousVersionId!,successorVersionId:change.currentVersionId!})).sort((left,right)=>compare(`${left.kind}\0${left.logicalId}`,`${right.kind}\0${right.logicalId}`));
  const authoritativeRemovals=input.authorizeRemovals===true&&input.currentCrawlAttempt?.status==="completed"&&!input.currentCrawlAttempt.restrictions.length;
  const withoutFingerprint={schemaVersion:1 as const,previousCrawlAttemptId:previousAttempt,currentCrawlAttemptId:currentAttempt,sourceChanges,blockChanges,factChanges,factVersions,staleEvidence,removals:{authoritative:authoritativeRemovals,reason:authoritativeRemovals?"complete_crawl" as const:"incomplete_or_unverified_crawl" as const,sourceDocumentIds:sourceChanges.filter(change=>change.state==="removed").map(change=>change.previousVersionId!).sort(compare),sourceBlockIds:blockChanges.filter(change=>change.state==="removed").map(change=>change.previousVersionId!).sort(compare),factVersionIds:factChanges.filter(change=>change.state==="removed").map(change=>change.previousVersionId!).sort(compare)},conflicts,preservedHumanCorrections,predecessorLineage};
  return {...withoutFingerprint,fingerprint:hash(withoutFingerprint)};
}
