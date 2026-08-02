import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { DeterministicConflict } from "./contracts";
const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9$€£%]+/g," ").trim();
const owner=(f:WebsiteKnowledgeFact)=>f.evidence.some((e)=>e.url.startsWith("owner://"));
export function mergeFacts(input: WebsiteKnowledgeFact[]): {facts:WebsiteKnowledgeFact[]; conflicts:DeterministicConflict[]} {
  const facts: WebsiteKnowledgeFact[]=[];
  for (const fact of input) {
    const same=facts.find((item)=>item.category===fact.category && (norm(item.value)===norm(fact.value) || (norm(item.value).length>35 && (norm(item.value).includes(norm(fact.value))||norm(fact.value).includes(norm(item.value))))));
    if (!same) { facts.push(fact); continue; }
    same.evidence=[...same.evidence,...fact.evidence.filter((e)=>!same.evidence.some((x)=>x.url===e.url&&x.excerpt===e.excerpt))];
    if (fact.value.length>same.value.length) { same.value=fact.value; same.title=fact.title; }
    if (owner(fact)) same.confidence="high";
  }
  const conflicts: DeterministicConflict[]=[];
  const material=/\b(?:pricing_plan|policy|contact_information|location_service_area)\b/;
  for (const category of Array.from(new Set(facts.map((f)=>f.category)))) {
    if (!material.test(category)) continue;
    const group=facts.filter((f)=>f.category===category); const values=new Set(group.flatMap((f)=>f.value.match(/(?:[$€£]\s?\d[\d,.]*|\d+(?:\.\d+)?%|[\w.+-]+@[\w.-]+\.\w{2,})/gi)??[]).map(norm));
    if(values.size<2) continue;
    const preferred=group.find(owner)??group[0]; conflicts.push({id:`conflict:${category}:${conflicts.length+1}`,topic:category,preferredFact:preferred,conflictingFacts:group.filter((f)=>f!==preferred),reason:owner(preferred)?"Owner-provided knowledge takes priority; conflicting website evidence was retained.":"Different source-supported values require review."});
  }
  return {facts,conflicts};
}
