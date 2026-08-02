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
        if (candidates.some((item) => item.evidence.url === url))
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
        const repeated = (occurrences.get(keyText(item.text))?.size ?? 0) > 1;
        if (!repeated)
            return true;
        if (/\b(price|refund|cancel|support|email|phone|address|location|service|policy|hours?)\b/i
            .test(item.text)) {
            return true;
        }
        if (CHROME.test(item.text))
            return false;
        return !/\b(?:newsletter|cookie preferences|accessibility menu|follow us on|terms of website use)\b/i
            .test(item.text);
    });
    return retained.map((item, index) => ({
        ...item,
        previousBlockId: retained[index - 1]?.id,
        nextBlockId: retained[index + 1]?.id,
    }));
}
