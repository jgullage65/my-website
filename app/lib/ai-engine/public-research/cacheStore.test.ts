import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { researchPublicBusiness } from "./engine";
import { gleifAdapter } from "./adapters";
import { GLEIF_POLICY } from "./policy";
import { ResearchFetcher } from "./transport";
import type { ResearchSnapshot } from "./contracts";
let cached: ResearchSnapshot | null = null;
const queries: string[]=[];
const sql=async(parts:TemplateStringsArray,..._values:unknown[])=>{
 const query=parts.join("?");queries.push(query);
 if(query.startsWith("SELECT snapshot"))return [{snapshot:cached}];
 return []; // Subject lease is held elsewhere or next_attempt_at is in the future.
};
mock.module("../../db/client.ts",{namedExports:{getSql:()=>sql}});
mock.module("../crawler/websiteSourceRecordStore.ts",{namedExports:{persistWebsiteSourceRecords:async()=>{throw new Error("cached reader must not persist evidence");}}});
const {runStoredPublicResearch}=await import("./store");
const identity={name:"Acme",address:"1 Main St",city:"Austin",state:"TX",country:"US"};
async function seed(){
 const payload={data:{id:"ABCDEFGHIJKLMNOPQRST",attributes:{entity:{legalName:{name:"Acme"},legalAddress:{addressLines:["1 Main St"],city:"Austin",region:"US-TX",country:"US"}},registration:{status:"ISSUED"}}}};
 cached=await researchPublicBusiness(identity,{adapters:[gleifAdapter],fetcher:new ResearchFetcher(undefined,async url=>{
 const body=url.pathname==="/robots.txt"?"":JSON.stringify(url.pathname.endsWith("lei-records")?{data:[payload.data]}:payload);
 return {status:200,ok:true,headers:new Headers({"content-type":url.pathname==="/robots.txt"?"text/plain":"application/json"}),body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(body));c.close();}})};
 },async()=>true)});
 process.env.PUBLIC_RESEARCH_IDENTITY_HASH_SECRET="isolated-test-key";
}
test("active-lease and backoff readers get independently validated immutable cache views",async()=>{
 await seed();const before=JSON.stringify(cached);
 const views=await Promise.all([runStoredPublicResearch(identity),runStoredPublicResearch(identity)]);
 assert.ok(views.every(v=>v?.facts.length));assert.notEqual(views[0],cached);assert.notEqual(views[0],views[1]);
 assert.equal(JSON.stringify(cached),before);
 assert.ok(!queries.some(q=>q.startsWith("UPDATE ai_builder_public_research_state")));
});
test("expired, revoked and stale caches cannot publish commercial findings during active leases",async()=>{
 await seed();const saved=GLEIF_POLICY.expiresAt;
 try {GLEIF_POLICY.expiresAt="2020-01-01";assert.equal((await runStoredPublicResearch(identity))?.facts.length,0);}finally{GLEIF_POLICY.expiresAt=saved;}
 const commercial=GLEIF_POLICY.rights.commercialUse;
 try{GLEIF_POLICY.rights.commercialUse=false;assert.equal((await runStoredPublicResearch(identity))?.blocks.length,0);}finally{GLEIF_POLICY.rights.commercialUse=commercial;}
 cached!.attempt.completedAt="2020-01-01T00:00:00Z";
 assert.equal((await runStoredPublicResearch(identity))?.facts.length,0);
 assert.ok(cached!.facts.length,"historical data remains retained");
});
