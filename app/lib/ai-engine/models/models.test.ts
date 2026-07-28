import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MODEL_IDS,MODEL_REGISTRY,ModelSelectionError,resolveModel } from "./registry";
import { ModelExecutionError,runPerplexity } from "./perplexityAdapter";

test("registry resolves stable IDs and canonical defaults",()=>{
 assert.equal(resolveModel(undefined,"crawl").id,DEFAULT_MODEL_IDS.crawl);
 assert.equal(resolveModel("claude-sonnet","test-assistant").gatewayModelId,"anthropic/claude-sonnet-4-6");
 assert.equal(new Set(MODEL_REGISTRY.map(x=>x.id)).size,MODEL_REGISTRY.length);
});
test("registry rejects unknown and disabled selections",()=>{
 assert.throws(()=>resolveModel("provider/arbitrary","crawl"),(e:any)=>e instanceof ModelSelectionError&&e.code==="model_unknown");
 assert.throws(()=>resolveModel("llama-flagship","crawl"),(e:any)=>e.code==="model_disabled");
});
test("adapter constructs and normalizes a provider request",async()=>{
 const oldKey=process.env.PERPLEXITY_API_KEY,oldFetch=global.fetch;process.env.PERPLEXITY_API_KEY="server-secret";
 let request:any;global.fetch=(async(_url:any,init:any)=>{request=JSON.parse(init.body);assert.equal(init.headers.authorization,"Bearer server-secret");return new Response(JSON.stringify({id:"req",output_text:" hello ",usage:{input_tokens:2,output_tokens:3,total_tokens:5}}),{status:200,headers:{"x-request-id":"request-1"}})}) as any;
 try{const model=resolveModel("gpt-5-5","crawl"),result=await runPerplexity({model,messages:[{role:"user",content:"content"}],instructions:"rules",maxOutputTokens:100,timeoutMs:1000});assert.equal(request.model,model.gatewayModelId);assert.equal(result.text,"hello");assert.deepEqual(result.usage,{inputTokens:2,outputTokens:3,totalTokens:5});assert.equal(result.requestId,"request-1");}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.PERPLEXITY_API_KEY;else process.env.PERPLEXITY_API_KEY=oldKey;}
});
test("adapter normalizes provider and timeout failures",async()=>{
 const oldKey=process.env.PERPLEXITY_API_KEY,oldFetch=global.fetch;process.env.PERPLEXITY_API_KEY="x";const model=resolveModel(undefined,"crawl");
 try{global.fetch=(async()=>new Response("no",{status:429})) as any;await assert.rejects(()=>runPerplexity({model,messages:[],maxOutputTokens:1,timeoutMs:100}), (e:any)=>e instanceof ModelExecutionError&&e.category==="rate_limit");global.fetch=((_u:any,i:any)=>new Promise((_r,reject)=>i.signal.addEventListener("abort",()=>reject(new Error("abort"))))) as any;await assert.rejects(()=>runPerplexity({model,messages:[],maxOutputTokens:1,timeoutMs:1}),(e:any)=>e.category==="timeout");}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.PERPLEXITY_API_KEY;else process.env.PERPLEXITY_API_KEY=oldKey;}
});
