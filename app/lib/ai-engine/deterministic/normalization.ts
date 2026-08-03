import { classifyPage } from "./classification";
import type { DeterministicEngineInput, DeterministicSourceType, NormalizedSourceBlock, } from "./contracts";
import { canonicalUrl, cleanText, keyText, stableId } from "./util";
const CHROME = /^(skip to (?:main )?content|accept (?:all )?cookies?|cookie settings|privacy preferences|subscribe(?: to our newsletter)?|follow us|all rights reserved|© ?\d{4}|menu|close menu|back to top|get started|learn more|read more|contact us)$/i;
export function normalizeSources(input: DeterministicEngineInput): NormalizedSourceBlock[] {
    const documents = new Map((input.sourceDocuments ?? []).map((document) => [document.id, document]));
    const pageByUrl = new Map((input.pages ?? []).map((page) => [canonicalUrl(page.url), page]));
    const candidates: NormalizedSourceBlock[] = [];
    let activeDocumentId: string | undefined;
    let heading: string | undefined;
    for (const block of input.sourceBlocks ?? []) {
        const document = documents.get(block.sourceDocumentId);
        if (!document)
            continue;
        if (activeDocumentId !== block.sourceDocumentId) {
            activeDocumentId = block.sourceDocumentId;
            heading = undefined;
        }
        const url = canonicalUrl(document.canonicalUrl ?? document.actualFetchedUrl);
        const page = pageByUrl.get(url);
        const text = cleanText(block.normalizedText);
        if (!text)
            continue;
        if (block.type === "heading")
            heading = text;
        const pageType = classifyPage(page ?? { url }, heading);
        candidates.push({
            id: block.id,
            text,
            type: block.type,
            pageType,
            heading,
            evidence: {
                url,
                excerpt: text,
                sourceDocumentId: document.id,
                sourceBlockId: block.id,
                crawlAttemptId: block.crawlAttemptId,
                heading,
                pageTitle: page?.title,
                pageType,
                sourceType: (block.extractionMethod === "json_ld" ? "structured_data" : document.sourceType) as DeterministicSourceType,
                provenance: "website",
                structured: block.extractionMethod === "json_ld",
            },
        });
    }
    for (const page of input.pages ?? []) {
        if (!page.text)
            continue;
        const url = canonicalUrl(page.url);
        // Headings and filtered chrome establish structure, but are not usable body
        // content and therefore must not suppress the page-text safety net.
        if (candidates.some((item) => item.evidence.url === url && item.type !== "heading" && !CHROME.test(item.text)))
            continue;
        const text = cleanText(page.text);
        const pageType = classifyPage(page);
        candidates.push({
            id: stableId("page", `${url}\0${text}`),
            text,
            type: "page_text",
            pageType,
            evidence: {
                url,
                excerpt: text,
                sourceDocumentId: page.sourceDocumentId,
                crawlAttemptId: page.crawlAttemptId,
                pageTitle: page.title,
                pageType,
                sourceType: "html",
                provenance: "website",
                structured: false,
            },
        });
    }
    const occurrences = new Map<string, Set<string>>();
    for (const item of candidates) {
        const identity = keyText(item.text);
        const urls = occurrences.get(identity) ?? new Set<string>();
        urls.add(item.evidence.url);
        occurrences.set(identity, urls);
    }
    const retained = candidates.filter((item) => {
        if (CHROME.test(item.text))
            return false;
        const repeated = (occurrences.get(keyText(item.text))?.size ?? 0) > 1;
        if (!repeated)
            return true;
        if (/\b(price|refund|cancel|support|email|phone|address|location|service|policy|hours?)\b/i
            .test(item.text)) {
            return true;
        }
        return !/\b(?:newsletter|cookie preferences|accessibility menu|follow us on|terms of website use)\b/i
            .test(item.text);
    });
    const previousByDocument = new Map<string | undefined, string>();
    const previousIds = retained.map(item => {
        const documentId = item.evidence.sourceDocumentId;
        const previous = previousByDocument.get(documentId);
        previousByDocument.set(documentId, item.id);
        return previous;
    });
    const nextByDocument = new Map<string | undefined, string>();
    const nextIds = new Array<string | undefined>(retained.length);
    for (let index = retained.length - 1; index >= 0; index -= 1) {
        const item = retained[index];
        nextIds[index] = nextByDocument.get(item.evidence.sourceDocumentId);
        nextByDocument.set(item.evidence.sourceDocumentId, item.id);
    }
    return retained.map((item, index) => ({ ...item, previousBlockId: previousIds[index], nextBlockId: nextIds[index] }));
}
