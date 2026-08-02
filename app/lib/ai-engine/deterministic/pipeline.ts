import { WEBSITE_KNOWLEDGE_COVERAGE_FIELDS, type WebsiteKnowledgeCoverage } from "../knowledge/websiteKnowledge";
import type { DeterministicBrain, DeterministicSource } from "./contracts";
import { extractSourceFacts } from "./extract"; import { mergeFacts } from "./merge";
const mapping:Record<string,string[]>={companyOverview:["company_overview"],products:["product"],services:["service"],pricingPlans:["pricing_plan"],pricing:["pricing_plan"],offers:["product","service"],customers:["customer_segment"],customerSegments:["customer_segment"],policies:["policy"],faq:["faq"],frequentlyAskedQuestions:["faq"],contact:["contact_information"],contactInformation:["contact_information"],locationsServiceAreas:["location_service_area"]};
export function buildDeterministicBrain(sources: DeterministicSource[]):DeterministicBrain {
  const merged=mergeFacts(sources.flatMap(extractSourceFacts));
  const coverage=Object.fromEntries(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.map((field)=>{const cats=mapping[field]??[];const matching=merged.facts.filter((f)=>cats.includes(f.category));return [field,Math.min(100,matching.length*25+Math.max(0,new Set(matching.flatMap((f)=>f.evidence.map((e)=>e.url))).size-1)*10)];})) as WebsiteKnowledgeCoverage;
  const supported=WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.filter((f)=>f!=="overall"&&coverage[f]>0); coverage.overall=Math.round(supported.reduce((n,f)=>n+coverage[f],0)/(WEBSITE_KNOWLEDGE_COVERAGE_FIELDS.length-1));
  const required=["company_overview","product_or_service","customer_segment","policy","contact_information"];
  const missingCategories=required.filter((category)=>category==="product_or_service"?!merged.facts.some((f)=>f.category==="product"||f.category==="service"):!merged.facts.some((f)=>f.category===category));
  return {...merged,coverage,missingCategories,unresolvedQuestions:missingCategories.map((c)=>`Add supported ${c.replaceAll("_"," ")} information.`)};
}
export * from "./contracts"; export * from "./normalize";
