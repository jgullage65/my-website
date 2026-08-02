import type { DeterministicSource, OwnerKnowledgeInput } from "./contracts";
import type { WebsiteSourceBlockRecord, WebsiteSourceDocumentRecord } from "../crawler/websiteSourceRecords";

const BOILERPLATE = /^(accept (all )?cookies?|cookie (settings|preferences)|privacy preferences|skip to (main )?content|menu|close|sign in|log in|copyright|all rights reserved|powered by|subscribe)$/i;
export function cleanSourceText(value: string): string {
  const seen = new Set<string>();
  return value.replace(/\u0000/g, "").split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3 && !BOILERPLATE.test(line) && !/^©\s*\d{4}/.test(line))
    .filter((line) => { const key = line.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).join("\n").trim();
}

export function normalizeWebsiteSources(documents: WebsiteSourceDocumentRecord[], blocks: WebsiteSourceBlockRecord[], pages: Array<{url:string; title:string; pageType:string}>): DeterministicSource[] {
  const docs = new Map(documents.map((item) => [item.id, item]));
  const pageByUrl = new Map(pages.map((page) => [page.url, page]));
  return blocks.flatMap((block) => {
    const doc = docs.get(block.sourceDocumentId); if (!doc) return [];
    const url = doc.canonicalUrl ?? doc.actualFetchedUrl; const page = pageByUrl.get(url);
    const text = cleanSourceText(block.normalizedText); if (!text) return [];
    return [{ id: block.id, type: "website" as const, url, title: page?.title ?? "", pageType: page?.pageType ?? "other", text, sourceDocumentId: doc.id, sourceBlockId: block.id, crawlAttemptId: block.crawlAttemptId }];
  });
}

export function normalizeOwnerSources(owner: OwnerKnowledgeInput): DeterministicSource[] {
  const fields: Array<[keyof OwnerKnowledgeInput,string,string]> = [
    ["businessName","Business name","company_overview"], ["industry","Industry","industry_served"],
    ["productsServices","Products and services","offers"], ["idealCustomers","Ideal customers","customer_segment"],
    ["policiesOperations","Policies and operations","policy"], ["successStoriesCaseStudies","Success stories and case studies","case_study"],
    ["additionalKnowledge","Additional owner knowledge","additional_business_knowledge"],
  ];
  return fields.flatMap(([key,title,pageType]) => { const text = cleanSourceText(owner[key] ?? ""); return text ? [{ id:`owner:${key}`, type:"owner" as const, title, pageType, heading:title, text }] : []; });
}
