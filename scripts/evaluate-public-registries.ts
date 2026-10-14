/** Controlled evaluation only. Production always uses the DNS-pinned native transport. */
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { localRegistryAdapters, registryRecord } from "../app/lib/ai-engine/public-research/localRegistries";
import { ResearchFetcher, type ResearchTransport } from "../app/lib/ai-engine/public-research/transport";
import { researchPublicBusiness } from "../app/lib/ai-engine/public-research/engine";
const run = promisify(execFile);
const [samplesPath, outputPath, mode] = process.argv.slice(2);
if (!samplesPath || !outputPath || !["native", "proxy-evaluation"].includes(mode ?? "")) throw new Error("Usage: <samples.json> <output.json> native|proxy-evaluation");
// curl honors the evaluation environment's HTTPS proxy and normal CA validation. This is NOT production DNS/SSRF verification.
const proxyWire: ResearchTransport = async (url, options) => {
  const dir = await mkdtemp(join(tmpdir(), "registry-eval-"));
  try {
    await run("curl", ["--silent", "--show-error", "--proto", "=https", "--max-time", "5", "--max-filesize", "750000", "--dump-header", join(dir,"headers"), "--output", join(dir,"body"), ...Object.entries(options.headers).flatMap(([k,v])=>["--header",`${k}: ${v}`]), url.href], {signal: options.signal,maxBuffer:100_000});
    const bytes = new Uint8Array(await readFile(join(dir,"body"))), raw = await readFile(join(dir,"headers"),"utf8");
    const header = raw.trim().split(/\r?\n\r?\n/).at(-1)!, lines = header.split(/\r?\n/), status = Number(lines.shift()?.split(" ")[1]);
    const headers = new Headers(); for (const line of lines) {const i=line.indexOf(":");if(i>0)headers.append(line.slice(0,i),line.slice(i+1).trim());}
    return {status,ok:status===200,headers,body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};
  } finally {await rm(dir,{recursive:true,force:true});}
};
const samples = JSON.parse(await readFile(samplesPath,"utf8"));
const results = [];
for (const sample of samples) {
  const record = registryRecord(sample.policyId, JSON.stringify([sample.record]));
  if (!record) throw new Error("unsupported_sample");
  const identity = {...record.identity, name: record.identity.formerNames?.[0] || record.identity.name, category:sample.category};
  delete identity.phone;
  const adapter = localRegistryAdapters.find(a=>a.policy.id===sample.policyId)!;
  const snapshot = await researchPublicBusiness(identity,{adapters:[adapter],fetcher: new ResearchFetcher(undefined,mode === "proxy-evaluation" ? proxyWire : undefined)});
  const result = {business:identity.name,category:sample.category,policyId:sample.policyId,outcomes:snapshot.outcomes,facts:snapshot.facts.map(f=>({value:f.value,category:f.category,evidenceCount:f.evidence.length})),metrics:snapshot.metrics};
  results.push(result); console.log(JSON.stringify({business:identity.name,accepted:result.facts.length>0,requests:result.metrics.requests,durationMs:result.metrics.durationMs}));
}
await writeFile(outputPath,JSON.stringify({evaluatedAt:new Date().toISOString(),mode,productionNetworkVerified:false,results},null,2)+"\n");
