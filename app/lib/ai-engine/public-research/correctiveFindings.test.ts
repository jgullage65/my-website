import { createHash } from "node:crypto";
import { buildDeterministicBusinessBrain } from "../deterministic";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { researchPublicBusiness } from "./engine";
import { gleifAdapter, type SourceAdapter } from "./adapters";
import { ResearchFetcher, RESEARCH_LIMITS } from "./transport";
import { GLEIF_POLICY } from "./policy";
import { matchBusiness } from "./matching";
import { validatedCacheView } from "./reuse";
import { publicResearchSubjectKey } from "./identityKey";
import { publicDeterministicFacts } from "./coverage";
import { scoreConfidence } from "../deterministic/confidence";
import { mergeResearchResult } from "./orchestration";
import { reconcileFacts } from "./reconciliation";
const target = {name:"Acme LLC",address:"123 Main St",city:"Austin",state:"TX",country:"US"};
const record = {id:"ABCDEFGHIJKLMNOPQRST",attributes:{lei:"ABCDEFGHIJKLMNOPQRST",entity:{legalName:{name:"Acme LLC"},legalAddress:{addressLines:["123 Main St"],city:"Austin",region:"US-TX",country:"US"},registeredAs:"123",registeredAt:{id:"US-REG"},status:"ACTIVE"},registration:{status:"ISSUED"}}};
const response = (value:unknown,status=200,plain=false) => ({status,ok:status===200,headers:new Headers({"content-type":plain?"text/plain":"application/json",etag:'"unchanged"'}),body:new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode(plain?String(value):JSON.stringify(value)));c.close();}})});
function fixtureFetcher(notModified=false) {
 return new ResearchFetcher(undefined,async url=>url.pathname==="/robots.txt"?response("",200,true):url.pathname.endsWith("lei-records")?response({data:[record]}):response(notModified?null:{data:record},notModified?304:200),async()=>true);
}
const original = () => researchPublicBusiness(target,{adapters:[gleifAdapter],fetcher:fixtureFetcher()});

test("304 revalidates unchanged source identity and keeps immutable IDs and original retrieval date",async()=>{
 const previous=await original(), current=await researchPublicBusiness(target,{previous,adapters:[gleifAdapter],fetcher:fixtureFetcher(true)});
 assert.equal(current.outcomes[0]?.state,"accepted"); assert.equal(current.outcomes[0]?.match?.scope,"business_location");
 assert.equal(current.documents[0]?.id,previous.documents[0]?.id); assert.equal(current.facts[0]?.research.retrievedAt,previous.facts[0]?.research.retrievedAt);
 assert.ok(current.facts[0]?.research.validatedAt); assert.equal(current.metrics.bytes < previous.metrics.bytes,true);
});
for(const [label,change] of [
 ["changed address",{address:"999 Other Rd"}], ["changed branch",{branch:"north"}],
 ["mismatched registration",{registrationId:"999",registrationAuthority:"US-REG"}],
] as const) test("304 cannot reaffirm "+label,async()=>{
 const previous=await original(),current=await researchPublicBusiness({...target,...change},{previous,adapters:[gleifAdapter],fetcher:fixtureFetcher(true)});
 assert.equal(current.facts.filter(f=>f.research.state==="supported").length,0);
 assert.notEqual(current.outcomes[0]?.state,"accepted");
 assert.equal((mergeResearchResult(null,current).research as any).depth,"insufficient_evidence");
 assert.equal(previous.facts[0]?.research.state,"supported","history was not mutated");
});
test("legacy or insufficient identity records never justify 304 reuse",async()=>{
 for(const variant of ["missing","incomplete","binding"]){
 const previous=await original();
 if(variant==="missing") delete previous.outcomes[0]!.sourceIdentity;
 if(variant==="incomplete") previous.outcomes[0]!.sourceIdentity={name:target.name};
 if(variant==="binding") previous.outcomes[0]!.fingerprint="not-the-immutable-content-hash";
 const current=await researchPublicBusiness(target,{previous,adapters:[gleifAdapter],fetcher:fixtureFetcher(true)});
 assert.notEqual(current.outcomes[0]?.state,"accepted");assert.equal(current.facts.filter(f=>f.research.state==="supported").length,0);
 }
});
test("exact subject keys differ for material identities; 304 safety does not depend only on a key",()=>{
 for(const change of [{address:"moved"},{branch:"north"},{registrationId:"123"},{state:"WA"}]) assert.notEqual(publicResearchSubjectKey(target,"secret"),publicResearchSubjectKey({...target,...change},"secret"));
});
test("registration confirms legal scope while exact establishment evidence confirms location scope",()=>{
 const a={name:"Acme",registrationId:"123",registrationAuthority:"registry"};
 assert.equal(matchBusiness(a,a).scope,"legal_entity");
 assert.equal(matchBusiness({...a,branch:"north"},a).scope,"legal_entity");
 assert.equal(matchBusiness({...target,...a},{...target,...a}).scope,"business_location");
 assert.equal(matchBusiness({...target,...a},{...target,...a,address:"999 Other Rd"}).classification,"rejected");
 assert.equal(matchBusiness({...a,branch:"north"},{...a,branch:"south"}).classification,"rejected");
});
test("confirmed legal registrations retain only legal facts when location evidence is incomplete",async()=>{
 const previous=await researchPublicBusiness({name:target.name,registrationId:"123",registrationAuthority:"US-REG"},{adapters:[gleifAdapter],fetcher:fixtureFetcher()});
 assert.ok(previous.facts.length); assert.ok(previous.facts.every(f=>f.research.match.scope==="legal_entity" && f.research.claimScope==="legal_entity"));
 const location={...previous.facts[0]!,research:{...previous.facts[0]!.research,claimScope:"business_location" as const}};
 assert.equal(reconcileFacts([],[location]).facts.length,0);
 assert.ok(reconcileFacts([],previous.facts).facts.length);
});
test("cache publication rechecks expired reviews, revocations, scope and freshness without mutating history",async()=>{
 const previous=await original(), saved=JSON.stringify(previous);
 for(const policy of [{...GLEIF_POLICY,expiresAt:"2020-01-01"},{...GLEIF_POLICY,excluded:true},{...GLEIF_POLICY,rights:{...GLEIF_POLICY.rights,commercialUse:false}},{...GLEIF_POLICY,rights:{...GLEIF_POLICY.rights,retainFacts:false}}]) {
  const view=validatedCacheView(previous,target,{policies:[policy]});
  assert.equal(view.facts.length,0);assert.equal(view.blocks.length,0);assert.equal(view.documents.length,0);assert.equal(view.coverage.overall,0);
 }
 assert.equal(validatedCacheView(previous,{...target,address:"other"}).facts.length,0);
 assert.equal(validatedCacheView(previous,target,{now:Date.parse(previous.attempt.completedAt)+7*60*60_000}).facts.length,0);
 assert.equal(JSON.stringify(previous),saved);
 const current=validatedCacheView(previous,target);assert.equal(current.facts.length,previous.facts.length);assert.equal(current.facts[0]?.research.retrievedAt,previous.facts[0]?.research.retrievedAt);
});
test("reuse distinguishes commercial retention rights from permission for a new network crawl",async()=>{
 const previous=await original(),policy={...GLEIF_POLICY,rights:{...GLEIF_POLICY.rights,access:false,automate:false,extract:false}};
 const view=validatedCacheView(previous,target,{policies:[policy]});assert.equal(view.facts.length,previous.facts.length);
});
test("public provenance survives confidence, coverage, API serialization and cannot become website support",async()=>{
 const current=await original(), facts=publicDeterministicFacts(current.facts),scored=scoreConfidence(facts,[]);
 assert.ok(facts.every(f=>f.provenance==="public_record" && f.evidence.every(e=>e.provenance==="public_record")));
 assert.ok(scored.every(f=>f.provenance==="public_record"));
 const web={...facts[0]!,provenance:"website" as const,evidence:facts[0]!.evidence.map(e=>({...e,provenance:"website" as const}))};
 assert.equal(scoreConfidence([web],[])[0]?.confidenceScore,scoreConfidence([{...web,provenance:"public_record"}],[])[0]?.confidenceScore,"official authority does not itself inflate confidence");
 const event=JSON.parse(JSON.stringify(mergeResearchResult(null,current)));
 assert.ok(event.knowledge.facts.every((f:any)=>f.provenance==="public_record" && f.research.claimScope==="legal_entity"));
 const uncertain={...current.facts[0]!,research:{...current.facts[0]!.research,state:"uncertain" as const}};
 assert.equal(reconcileFacts([],[uncertain]).facts.length,0);
});

function adapter(id:string,count:number,options:{duplicate?:boolean; expensive?:boolean; fail?:boolean}={}):SourceAdapter {
 const policy={...GLEIF_POLICY,id,origin:`https://${id}.test`,paths:["/records"],independenceGroup:id,minIntervalMs:0};
 return {id,policy,minimumRequests:3,async discover(_identity,f){
  if(options.fail)throw new Error("source timeout");
  if(options.expensive)for(let n=0;n<10;n++)await f.get(`${policy.origin}/records/discover-${n}`,policy);
  return Array.from({length:count},(_,i)=>({url:`${policy.origin}/records/${options.duplicate?0:i}`,policyId:id,discoveredBy:id,discoveredFrom:policy.origin}));
 }};
}
function fairFetcher(wrongHosts = ["a"]){return new ResearchFetcher(undefined,async url=>{
 if(url.pathname==="/robots.txt")return response("",200,true);
 const name=wrongHosts.includes(url.host.split(".")[0]!)?"Wrong company":target.name;
 const result=response(`<html><main><h1>${name} Services</h1><p>We provide commercial plumbing services for business customers.</p><p>Our company specializes in commercial maintenance.</p></main><script type="application/ld+json">${JSON.stringify({"@type":"LocalBusiness",name,address:{streetAddress:target.address,addressLocality:target.city,addressRegion:target.state,addressCountry:"US"}})}</script><h2>Services</h2><p>We provide commercial plumbing services and emergency repairs for local businesses.</p></html>`,200,true);
 result.headers.set("content-type","text/html");return result;
},async()=>true);}

for(const [label,options] of [["four wrong candidates",{}],["duplicate candidates",{duplicate:true}],["timeout",{fail:true}],["discovery request exhaustion",{expensive:true}]] as const) test("fair scheduling preserves a useful second source after "+label,async()=>{
 const current=await researchPublicBusiness(target,{adapters:[adapter("a",4,options),adapter("b",1)],fetcher:fairFetcher()});
 assert.ok(current.outcomes.some(o=>o.policyId==="b" && o.state==="accepted"));
 assert.ok(current.facts.some(f=>f.research.policyId==="b"));
 assert.ok(current.metrics.requests<=RESEARCH_LIMITS.requests);
 assert.ok(current.outcomes.filter(o=>o.discoveredBy).length<=RESEARCH_LIMITS.aggregateCandidates);
 if(options.duplicate)assert.equal(current.outcomes.filter(o=>o.policyId==="a").length,1);
});
test("three competing sources share bounded opportunities instead of one monopolizing requests",async()=>{
 const current=await researchPublicBusiness(target,{adapters:[adapter("a",4),adapter("b",1),adapter("c",1)],fetcher:fairFetcher()});
 assert.ok(current.outcomes.some(o=>o.policyId==="b"&&o.state==="accepted"));assert.ok(current.outcomes.some(o=>o.policyId==="c"&&o.state==="accepted"));
 assert.ok(current.metrics.requests<=10);assert.ok(current.metrics.bytes<=RESEARCH_LIMITS.totalBytes);
});
test("actual Seattle eligibility and four wrong branches leave the WA contractor adapter a full useful opportunity",async()=>{
 const identity={...target,city:"Seattle",state:"WA",category:"construction contractor"};
 const rows=Array.from({length:4},(_,i)=>({business_legal_name:identity.name,street_address:`${900+i} Wrong St`,city:"SEATTLE",state:"WA",city_account_number:String(i)}));
 const wa={businessname:identity.name,address1:identity.address,city:"Seattle",state:"WA",contractorlicensenumber:"ACME123",contractorlicensestatus:"ACTIVE"};
 const fetcher=new ResearchFetcher(undefined,async url=>{
 if(url.pathname==="/robots.txt")return response("",200,true);
 const seattle=url.host==="data.seattle.gov";
 if(url.pathname.startsWith("/api/views/"))return response({id:seattle?"wnbq-64tb":"m8qx-ubtq",licenseId:seattle?"PUBLIC_DOMAIN":"PDDL"});
 if(url.searchParams.has("$order"))return response(seattle?rows:[wa]);
 if(seattle){const i=Number(url.searchParams.get("$where")?.match(/'(\d+)'/)?.[1]);return response([rows[i]]);}
 return response([wa]);
 },async()=>true);
 const current=await researchPublicBusiness(identity,{fetcher});
 assert.ok(current.facts.some(f=>f.research.policyId==="washington-contractor-license-pddl"));
 assert.ok(!current.facts.some(f=>f.research.policyId==="seattle-business-license-public-domain"));
 assert.equal(current.metrics.requests,10);
 assert.ok(current.outcomes.some(o=>o.policyId===GLEIF_POLICY.id && o.reason==="aggregate_request_reservation"));
});

test("per-adapter deadline cancellation releases its scope without aborting later eligible sources",async()=>{
 const f=new ResearchFetcher(undefined,async (_url,options)=>new Promise((resolve,reject)=>{
   if(options.signal.aborted){reject(options.signal.reason);return;}
   options.signal.addEventListener("abort",()=>reject(options.signal.reason),{once:true});
   if(!f.metrics.requests || f.metrics.requests>1) resolve(response("",200,true));
 }),async()=>true);
 // Keep an ordinary referenced timer alive while AbortSignal.timeout uses an unreferenced timer in Node.
 const hold=setTimeout(()=>{},100);
 try{await assert.rejects(f.withinRequestBudget(2,()=>f.get("https://api.gleif.org/api/v1/lei-records",GLEIF_POLICY),5));}
 finally{clearTimeout(hold);}
 assert.equal(f.signal.aborted,false);
 const later=await f.get("https://api.gleif.org/api/v1/lei-records/ABCDEFGHIJKLMNOPQRST",GLEIF_POLICY);
 assert.equal(later.status,200);assert.ok(f.metrics.requests<=10);
});
test("permission-filtered cache cannot alter successful website facts or leak blocked content",async()=>{
 const previous=await original(),website={type:"result",ok:true,knowledge:{facts:[{category:"service",title:"Services",value:"Original website finding",confidence:"high",evidence:[]}],coverage:{overall:90},unresolvedQuestions:[]},pages:[]};
 const view=validatedCacheView(previous,target,{policies:[{...GLEIF_POLICY,excluded:true}]});
 const result=mergeResearchResult(website,view);
 assert.deepEqual(result.knowledge,website.knowledge);assert.equal((result.research as any).depth,"full_website");
 assert.equal((result.research as any).sourceFacts.length,0);assert.equal((result.sourceBlocks as any[]).length,0);
 const failed=structuredClone(previous);failed.outcomes[0]!.state="source_unavailable";failed.facts[0]!.research.state="stale";
 assert.equal(validatedCacheView(failed,target).facts.length,0);assert.ok(failed.documents.length);
});

test("recorded Seattle registry evidence still passes actual adapter eligibility and bounded discovery",async()=>{
 const fixture=JSON.parse(readFileSync("test/fixtures/local-registry-live-evaluation.json","utf8"));
 const sample=fixture.rounds[0].results.find((r:any)=>r.business==="CANLIS INC");
 const value=(title:string)=>sample.facts.find((f:any)=>f.value.startsWith(title+": "))?.value.slice(title.length+2);
 const parts=value("Registered address (not verified operating location)").split(", ");
 const identity={name:sample.business,address:parts.slice(0,-3).join(", "),city:parts.at(-3),state:parts.at(-2),postalCode:parts.at(-1),category:sample.category};
 const where=new URL(sample.outcomes[0].url).searchParams.get("$where")!;
 const key=where.match(/'([^']+)'/)![1];
 const row={business_legal_name:value("Registered business name"),trade_name:value("Published trade name"),street_address:identity.address,city:identity.city,state:identity.state,zip:identity.postalCode,city_account_number:key,naics_description:value("Registered industry classification (NAICS)")};
 const f=new ResearchFetcher(undefined,async url=>url.pathname==="/robots.txt"?response("",200,true):url.host==="data.seattle.gov"?response(url.pathname.startsWith("/api/views/")?{id:"wnbq-64tb",licenseId:"PUBLIC_DOMAIN"}:[row]):response({data:[]}),async()=>true);
 const result=await researchPublicBusiness(identity,{fetcher:f});
 assert.ok(result.facts.some(f=>f.research.policyId==="seattle-business-license-public-domain"));
 assert.ok(result.outcomes.some(o=>o.policyId==="washington-contractor-license-pddl"&&o.reason==="outside_supported_jurisdiction_or_category"));
 assert.ok(result.metrics.requests<=10);
});

test("complete owner/website deterministic output equals the captured unchanged-main characterization",()=>{
 const fixture=JSON.parse(readFileSync("test/fixtures/website-provenance-compatibility.json","utf8"));
 const result=buildDeterministicBusinessBrain(fixture.input);result.executionTimeMs=0;
 assert.equal(createHash("sha256").update(JSON.stringify(result)).digest("hex"),fixture.expectedSha256);
 assert.ok(result.facts.every(f=>f.provenance === "website" || f.provenance === "owner"));
});

test("aggregate candidate reservations protect a third source after two four-candidate wrong sources",async()=>{
 const current=await researchPublicBusiness(target,{adapters:[adapter("a",4),adapter("b",4),adapter("c",1)],fetcher:fairFetcher(["a","b"])});
 assert.ok(current.outcomes.some(o=>o.policyId==="c"&&o.state==="accepted"));
 assert.ok(current.metrics.requests<=10);assert.ok(current.outcomes.filter(o=>o.discoveredBy).length<=8);
});
