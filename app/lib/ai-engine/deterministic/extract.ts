import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";
import type { DeterministicSource } from "./contracts";

type Category = WebsiteKnowledgeFact["category"];
const PAGE_CATEGORY: Record<string,Category> = { services:"service", products:"product", offers:"service", pricing:"pricing_plan", faq:"faq", policies:"policy", contact:"contact_information", locations:"location_service_area", case_studies:"competitive_differentiator", testimonials:"competitive_differentiator", integrations:"integration", technical:"technical_capability", about:"company_overview", home:"company_overview", company_overview:"company_overview", industry_served:"industry_served", customer_segment:"customer_segment", policy:"policy", case_study:"competitive_differentiator", additional_business_knowledge:"additional_business_knowledge" };
const SIGNALS: Array<[RegExp,Category,string]> = [
  [/\b(?:\$|€|£)\s?\d[\d,.]*(?:\s*\/\s*(?:month|year|hour))?|\b\d+(?:\.\d+)?%\s+(?:off|fee)|\b(?:starts?|starting) at\b/i,"pricing_plan","Pricing"],
  [/\b(?:refund|return|cancellation|shipping|warranty|guarantee|privacy)\b/i,"policy","Policy"],
  [/\b(?:email|call|phone|contact)\b|[\w.+-]+@[\w.-]+\.\w{2,}/i,"contact_information","Contact information"],
  [/\b(?:located|location|serving|service area|based in)\b/i,"location_service_area","Location or service area"],
  [/\b(?:integrates? with|integration)\b/i,"integration","Integration"],
  [/\b(?:SOC 2|HIPAA|GDPR|ISO 27001|PCI DSS|encrypted|security)\b/i,"security_compliance","Security and compliance"],
  [/\b(?:onboarding|support|implementation|training)\b/i,"support_onboarding","Support and onboarding"],
];
const split = (text:string) => text.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/).map((s)=>s.trim()).filter((s)=>s.length>=12 && s.length<=1200);
function evidence(source: DeterministicSource, excerpt: string) { return [{ url: source.url ?? `owner://${source.id}`, excerpt, ...(source.sourceDocumentId?{sourceDocumentId:source.sourceDocumentId}:{}), ...(source.sourceBlockId?{sourceBlockId:source.sourceBlockId}:{}), ...(source.crawlAttemptId?{crawlAttemptId:source.crawlAttemptId}:{}) }]; }
export function extractSourceFacts(source: DeterministicSource): WebsiteKnowledgeFact[] {
  const sentences = split(source.text); const facts: WebsiteKnowledgeFact[] = [];
  if (source.pageType === "faq") {
    for (let index=0;index<sentences.length-1;index+=1) if (sentences[index].endsWith("?") && !sentences[index+1].endsWith("?")) {
      const value=`${sentences[index]} ${sentences[index+1]}`;facts.push({category:"faq",title:sentences[index].slice(0,300),value,confidence:source.type==="owner"?"high":"high",evidence:evidence(source,value)});index+=1;
    }
  }
  for (const sentence of sentences) {
    if (/^(home|about|services|products|contact|learn more|read more)$/i.test(sentence)) continue;
    const signal = SIGNALS.find(([pattern]) => pattern.test(sentence));
    const category = signal?.[1] ?? PAGE_CATEGORY[source.pageType];
    if (!category) continue;
    // General pages need explicit, useful statements rather than isolated chrome.
    if (source.type !== "owner" && !signal && sentence.split(/\s+/).length < 4) continue;
    const title = (signal?.[2] ?? source.heading ?? source.title) || category.replaceAll("_", " ").replace(/\b\w/g,(c)=>c.toUpperCase());
    facts.push({ category, title: title.slice(0,300), value: sentence, confidence: source.type === "owner" ? "high" : (signal || ["services","products","pricing","faq","policies","contact","locations"].includes(source.pageType) ? "high" : "medium"), evidence: evidence(source,sentence) });
  }
  return facts;
}
