export type LeadForgeResearchRequest = {
  website?: unknown;
  externalReference?: unknown;
  modelId?: unknown;
};

type ResearchEvent = Record<string, unknown>;

export function normalizeExternalReference(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("external_reference_invalid");
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error("external_reference_invalid");
  return normalized;
}

export function toLeadForgeEvent(event: ResearchEvent, externalReference?: string): ResearchEvent {
  if (event.type === "progress") return { type: "progress", status: "building_intelligence", percent: event.percent };
  if (event.type === "crawl_progress") return { type: "progress", status: "crawling_website", pagesCrawled: event.pagesCrawled, pagesDiscovered: event.pagesDiscovered };
  if (event.type === "crawl_complete") return { type: "progress", status: "processing_sources", pagesCrawled: event.pagesCrawled, pagesDiscovered: event.pagesDiscovered };
  if (event.type === "error") return { type: "error", success: false, status: "failed", externalReference, error: event.error, crawlAttemptId: event.crawlAttemptId };
  if (event.type !== "result") return event;

  const imported = event.import && typeof event.import === "object" ? event.import as Record<string, unknown> : {};
  return {
    type: "result",
    success: true,
    status: "complete",
    externalReference,
    target: {
      requestedUrl: imported.requestedUrl,
      normalizedUrl: imported.resolvedUrl ?? imported.website,
    },
    businessKnowledgePack: {
      businessIdentity: {
        name: imported.businessName,
        industry: imported.industry,
        website: imported.website,
      },
      intakeSummary: {
        productsServices: imported.productsServices,
        idealCustomers: imported.idealCustomers,
        additionalKnowledge: imported.additionalKnowledge,
      },
      knowledge: event.knowledge,
    },
    sources: {
      documents: event.sourceDocuments,
      blocks: event.sourceBlocks,
    },
    crawl: {
      attemptId: event.crawlAttemptId,
      pages: event.pages,
      warnings: event.warnings,
      diagnostics: event.diagnostics,
      timings: event.timings,
    },
    usage: event.usage,
  };
}
