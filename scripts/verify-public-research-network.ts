/** Run INSIDE the staging deployment runtime; never substitutes a proxy or weakens DNS/TLS checks. */
import { ResearchFetcher } from "../app/lib/ai-engine/public-research/transport";
import { GLEIF_POLICY } from "../app/lib/ai-engine/public-research/policy";
import { LOCAL_REGISTRY_POLICIES } from "../app/lib/ai-engine/public-research/localRegistries";
const targets = [{policy:GLEIF_POLICY,path:"/api/v1/lei-records?page[size]=1"},...LOCAL_REGISTRY_POLICIES.map(policy=>({policy,path:policy.paths[1]!}))];
async function main() {
for (const {policy,path} of targets) {
 const fetcher = new ResearchFetcher();
 try {const r=await fetcher.get(policy.origin+path,policy);console.log(JSON.stringify({source:policy.id,ok:r.status===200,status:r.status,metrics:fetcher.metrics,nativePinnedTransport:true}));}
 catch(error) {console.log(JSON.stringify({source:policy.id,ok:false,reason:error instanceof Error ? error.message : "network_failed",metrics:fetcher.metrics,nativePinnedTransport:true}));process.exitCode=1;}
}

}
void main().catch(error => { console.error(error instanceof Error ? error.message : "network_check_failed"); process.exitCode = 1; });
