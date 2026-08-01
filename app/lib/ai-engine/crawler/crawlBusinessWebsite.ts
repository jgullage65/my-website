import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { buildTextBlocks, CRAWLER_VERSION, EXTRACTION_VERSION, sha256, stableSourceDocumentId, type WebsiteCrawlAttemptRecord, type WebsiteDiscoveryMethod, type WebsiteSourceBlockRecord, type WebsiteSourceDocumentRecord } from "./websiteSourceRecords";

export type CrawledBusinessPage = {
  url: string;
  title: string;
  pageType: string;
  text: string;
  sourceDocumentId?: string;
};

export type BusinessWebsiteCrawlResult = {
  requestedUrl: string;
  resolvedUrl: string;
  pages: CrawledBusinessPage[];
  warnings: string[];
  diagnostics: BusinessWebsiteCrawlDiagnostics;
  crawlAttempt: WebsiteCrawlAttemptRecord;
  sourceDocuments: WebsiteSourceDocumentRecord[];
  sourceBlocks: WebsiteSourceBlockRecord[];
};

export type BusinessWebsiteCrawlDiagnostics = {
  /** Unique eligible HTML identities admitted to the crawl queue, including the submitted entry. */
  pagesDiscovered: number;
  /** HTML responses whose extraction/duplicate pipeline completed, including pages subsequently skipped. */
  pagesProcessed: number;
  pagesFetchAttempted: number;
  pagesFetched: number;
  /** Fetches that cleanly returned no eligible HTML document, such as 404s or policy-rejected responses. */
  pagesFetchRejected: number;
  pagesExtractionAttempted: number;
  pagesExtractionSucceeded: number;
  pagesRetained: number;
  pagesSkipped: number;
  /** HTML fetch/read failures only; extraction failures are counted separately. */
  pagesFailed: number;
  pagesExtractionFailed: number;
  canonicalUrlsDetected: number;
  canonicalDuplicatesSkipped: number;
  redirectDuplicatesSkipped: number;
  exactDuplicatesSkipped: number;
  nearDuplicatesSkipped: number;
  alternateVariantsSkipped: number;
  alternateLinksRejected: number;
  alternateLinksNotSelected: number;
  alternatePagesDeduplicated: number;
  repeatedBoilerplateOccurrencesDiscounted: number;
  jsonLdBlocksDetected: number;
  jsonLdBlocksParsed: number;
  malformedJsonLdBlocksIgnored: number;
  supportedStructuredEntitiesDetected: number;
  structuredFactsRetained: number;
  /** Repeated facts removed during all bounded extraction attempts, including pages later discarded. */
  structuredFactsDeduplicated: number;
  headingsRetained: number;
  paragraphsRetained: number;
  listItemsRetained: number;
  tablesRetained: number;
  tableRowsRetained: number;
  definitionEntriesRetained: number;
  visibleFaqsRetained: number;
  hiddenElementsIgnored: number;
  semanticBlocksDeduplicated: number;
  extractionOutputTruncated: number;
  sitemapsDiscovered: number;
  sitemapFetchAttempted: number;
  sitemapsFetched: number;
  sitemapsParsed: number;
  sitemapsRejected: number;
  sitemapsFailed: number;
  pdfsDiscovered: number;
  pdfFetchAttempted: number;
  pdfsFetched: number;
  pdfParseAttempted: number;
  pdfsParsed: number;
  pdfsRetained: number;
  pdfsSkipped: number;
  pdfsFailed: number;
  pdfBytesDownloaded: number;
  pdfPagesParsed: number;
  pdfDocumentsTruncated: number;
  browserPagesQueued: number;
  browserRenderAttempts: number;
  browserPagesRendered: number;
  browserPagesSkipped: number;
  browserRenderFailures: number;
  browserRenderTimeouts: number;
  browserFallbacksUsed: number;
  browserRenderDurationMs: number;
  finalUrls: string[];
  restrictions: CrawlRestriction[];
  warningDetails: CrawlWarning[];
  timings: BusinessWebsiteCrawlTimings;
};

export type BusinessWebsiteCrawlTimings = {
  initialUrlResolutionMs: number;
  homepageFetchMs: number;
  sitemapDiscoveryMs: number;
  pageDiscoveryMs: number;
  pageCrawlingMs: number;
  pdfFetchMs: number;
  pdfParseMs: number;
  contentExtractionMs: number;
  totalCrawlDurationMs: number;
};

export type CrawlRestriction = { type: "access_denied" | "rate_limited" | "redirect_blocked" | "unsupported_protocol" | "unsupported_content_type" | "unsafe_destination" | "response_too_large"; url: string; status?: number };
export type CrawlWarning = { stage: "homepage_fetch" | "html_fetch" | "html_extraction" | "browser_render" | "pdf_fetch" | "pdf_parse"; message: string; url: string };

export class BusinessWebsiteCrawlError extends Error {
  constructor(message: string, public readonly diagnostics: BusinessWebsiteCrawlDiagnostics) { super(message); this.name = "BusinessWebsiteCrawlError"; }
}

export function resolveCrawledBusinessName(extractedName: unknown, crawl: Pick<BusinessWebsiteCrawlResult, "resolvedUrl" | "pages">): string {
  const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
  const extracted = normalize(extractedName);
  const home = crawl.pages.find((page) => page.pageType === "home") ?? crawl.pages[0];
  const homepageTitle = normalize(home?.title);
  const homepageCandidate = homepageTitle.split(/\s(?:\||[-–—]|::)\s/)[0]?.trim() ?? "";
  const generic = new Set(["home", "homepage", "welcome", "official site", "website"]);
  const internalLabels = /^(?:contact(?: us)?|about(?: us)?|services?|products?|pricing|faqs?|terms|privacy(?: policy)?)$/i;
  const internalTitles = new Set(crawl.pages.filter((page) => page.pageType !== "home").map((page) => normalize(page.title).toLowerCase()).filter(Boolean));
  if (extracted && !internalLabels.test(extracted) && !internalTitles.has(extracted.toLowerCase())) return extracted;
  if (homepageCandidate && !generic.has(homepageCandidate.toLowerCase())) return homepageCandidate;
  const label = new URL(crawl.resolvedUrl).hostname.replace(/^www\./i, "").split(".")[0] ?? "";
  return label.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

const MAX_HTML_BYTES = 750_000;
const FETCH_TIMEOUT_MS = 7_000;
const DNS_TIMEOUT_MS = 3_000;
const MAX_REDIRECTS = 3;
const MAX_CONCURRENT_FETCHES = 3;
const MAX_STRUCTURED_FACTS = 100;
const MAX_STRUCTURED_TEXT = 10_000;
const MAX_STRUCTURED_VALUE = 500;
const MAX_JSON_LD_DEPTH = 8;
const MAX_JSON_LD_ITEMS = 250;
const MAX_STRUCTURED_URLS = 10;
const PDF_LIMITS = {
  documents: 3,
  bytes: 10 * 1024 * 1024,
  pages: 75,
  characters: 50_000,
  fetchTimeoutMs: FETCH_TIMEOUT_MS,
  parseTimeoutMs: FETCH_TIMEOUT_MS,
  minimumCharacters: 80,
} as const;

const SEMANTIC_LIMITS = {
  text: 50_000, nodes: 12_000, depth: 60, headings: 80, paragraphs: 300,
  lists: 30, listItems: 180, itemsPerList: 30, tables: 10, tableRows: 30,
  tableColumns: 8, cell: 300, definitions: 80, faqs: 40, blocks: 500,
} as const;

const PRIORITY_PATHS = [
  "/",
  "/about",
  "/about-us",
  "/services",
  "/products",
  "/pricing",
  "/faq",
  "/faqs",
  "/contact",
  "/contact-us",
  "/policies",
  "/terms",
] as const;

const MAX_PAGES = 500;
const MAX_SITEMAP_FETCHES = 100;

const BROWSER_LIMITS = {
  pages: 3,
  renderTimeoutMs: 5_000,
  totalTimeMs: 12_000,
} as const;
const BROWSER_CANCELLATION_GRACE_MS = 1_000;
type BrowserLimits = { pages: number; renderTimeoutMs: number; totalTimeMs: number };

type RenderedHtml = { html: string; resolvedUrl: URL };
type BrowserRenderer = { render: (url: URL, timeoutMs: number, signal?: AbortSignal) => Promise<RenderedHtml | null>; close: () => Promise<void> };
type BrowserRoute = { request: () => { url: () => string }; abort: () => Promise<void>; continue: () => Promise<void> };
type SafeAddress = { address: string; family: 4 | 6 };
type SafeDestination = SafeAddress & { addresses?: SafeAddress[] };
type DestinationSafetyCheck = (url: URL) => Promise<SafeDestination | void>;
type PlaywrightBrowser = {
  newContext: (options: { javaScriptEnabled: boolean; serviceWorkers: "block" }) => Promise<{
    route: (pattern: string, handler: (route: BrowserRoute) => Promise<void>) => Promise<void>;
    routeWebSocket: (pattern: string, handler: (socket: { close: () => Promise<void> | void }) => Promise<void>) => Promise<void>;
    newPage: () => Promise<{
      goto: (url: string, options: { waitUntil: "networkidle"; timeout: number }) => Promise<unknown>;
      evaluate: <Result>(work: () => Result) => Promise<Result>;
      content: () => Promise<string>;
      url: () => string;
      close: () => Promise<void>;
    }>;
  }>;
  close: () => Promise<void>;
};
type LoadPlaywright = () => Promise<{ chromium: { launch: (options: { headless: boolean; args?: string[] }) => Promise<PlaywrightBrowser> } }>;

export async function createPlaywrightRenderer(assertSafe: DestinationSafetyCheck, baseHost: string, loadPlaywright?: LoadPlaywright, renderHost = baseHost): Promise<BrowserRenderer> {
  // Browser code and process startup are deliberately deferred until a weak page exists.
  // @ts-ignore Playwright is dynamically loaded so HTML-only crawls never initialize it; the local interface limits what the crawler can invoke.
  const { chromium } = await (loadPlaywright ? loadPlaywright() : import("playwright") as Promise<{ chromium: { launch: (options: { headless: boolean; args?: string[] }) => Promise<PlaywrightBrowser> }>);
  const pinnedHost = networkHost(renderHost);
  const browserUrlHost = net.isIP(pinnedHost) === 6 ? `[${pinnedHost}]` : pinnedHost;
  const approved = await assertSafe(new URL(`https://${browserUrlHost}/`));
  const resolverAddress = approved?.family === 6 ? `[${approved.address}]` : approved?.address;
  const resolverRules = approved
    ? `MAP ${pinnedHost} ${resolverAddress}`
    : undefined;
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-extensions",
      "--js-flags=--max-old-space-size=128",
      ...(resolverRules ? ["--no-proxy-server", `--host-resolver-rules=${resolverRules}`] : []),
    ],
  });
  let browserClosed = false;
  const closeBrowser = async () => {
    if (browserClosed) return;
    browserClosed = true;
    await browser.close();
  };
  try {
    const context = await browser.newContext({ javaScriptEnabled: true, serviceWorkers: "block" });
    await context.routeWebSocket("**", async (socket) => { await socket.close(); });
    await context.route("**/*", async (route) => {
      try {
        const destination = new URL(route.request().url());
        if ((destination.protocol !== "http:" && destination.protocol !== "https:") || networkHost(destination.hostname) !== pinnedHost || normalizeHost(destination.hostname) !== baseHost) throw new Error("Blocked browser destination");
        await assertSafe(destination);
        await route.continue();
      } catch { await route.abort(); }
    });
    const page = await context.newPage();
    return {
      render: async (url, timeoutMs, signal) => {
        const page = await context.newPage();
        let pageClosed = false;
        const closePage = async () => {
          if (pageClosed) return;
          pageClosed = true;
          try { await page.close(); } catch { /* Abort and cleanup are best effort. */ }
        };
        const abort = () => { void closePage(); };
        signal?.addEventListener("abort", abort, { once: true });
        try {
          if (signal?.aborted) throw new Error("Browser render aborted.");
          await page.goto(url.toString(), { waitUntil: "networkidle", timeout: timeoutMs });
          const serializedCharacters = await page.evaluate(() => document.documentElement?.outerHTML.length ?? 0);
          if (serializedCharacters > MAX_HTML_BYTES) throw new ResponseLimitError("Rendered page exceeds the extraction limit.");
          return { html: await page.content(), resolvedUrl: new URL(page.url()) };
        } finally {
          signal?.removeEventListener("abort", abort);
          await closePage();
        }
      },
      close: closeBrowser,
    };
  } catch (error) {
    try { await closeBrowser(); } catch { /* Initialization cleanup cannot hide the original failure. */ }
    throw error;
  }
}

const DISCOVERY_KEYWORDS = [
  "about",
  "service",
  "product",
  "pricing",
  "price",
  "package",
  "faq",
  "question",
  "contact",
  "policy",
  "policies",
  "terms",
  "process",
  "guarantee",
  "team",
  "solution",
  "industry",
  "customer",
  "guide",
  "documentation",
  "docs",
  "help",
  "case-study",
  "case-studies",
  "case_study",
  "case_studies",
  "resource",
  "academy",
] as const;

const EDITORIAL_PATH_SEGMENT = /^(?:blogs?|news|articles?|posts?|authors?|tags?|categories?|archives?)$/;
const YEAR_PATH_SEGMENT = /^(?:19|20)\d{2}$/;

const IGNORED_EXTENSIONS = new Set([
  "css",
  "js",
  "json",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "xml",
  "txt",
  "woff",
  "woff2",
  "ttf",
]);

const PDF_DURABLE_SIGNAL = /(?:^|[^a-z])(?:brochures?|menus?|catalog(?:ue)?s?|services?|pricing|prices?|rates?|polic(?:y|ies)|manuals?|guides?|specifications?|capabilities|products?|packages?)(?:[^a-z]|$)/i;
const PDF_EDITORIAL_SIGNAL = /(?:^|[^a-z])(?:newsletters?|press[\s_-]*releases?|magazines?|blogs?|news|articles?|posts?|archives?|annual[\s_-]*(?:content|archive))(?:[^a-z]|$)/i;

export function normalizeWebsiteCrawlInput(value: string): URL {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Website URL is required.");

  const parsed = new URL(
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
  );
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Website URL must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Website URL must not contain credentials.");
  }

  parsed.hash = "";
  return parsed;
}

function normalizeHost(hostname: string): string {
  return networkHost(hostname).replace(/^www\./i, "");
}

function networkHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

const UNSAFE_IPV4_RANGES = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) UNSAFE_IPV4_RANGES.addSubnet(address, prefix, "ipv4");

const UNSAFE_IPV6_RANGES = new net.BlockList();
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) UNSAFE_IPV6_RANGES.addSubnet(address, prefix, "ipv6");

function isUnsafeIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (
    parts.length !== 4 ||
    parts.some(
      (part) => !Number.isInteger(part) || part < 0 || part > 255,
    )
  ) {
    return true;
  }

  return UNSAFE_IPV4_RANGES.check(ip, "ipv4");
}

function isUnsafeIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // Public IPv6 unicast space is currently 2000::/3. Rejecting everything
  // outside it also excludes loopback, link/site local, mapped IPv4,
  // documentation-adjacent special space, and multicast destinations.
  return !/^[23][0-9a-f]{0,3}:/i.test(normalized) || UNSAFE_IPV6_RANGES.check(normalized, "ipv6");
}

function isUnsafeIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isUnsafeIpv4(ip);
  if (version === 6) return isUnsafeIpv6(ip);
  return true;
}

export async function assertSafeDestination(
  url: URL,
  lookup: (hostname: string, options: { all: true }) => Promise<{ address: string; family: number }[]> = dnsLookup,
  dnsTimeoutMs = DNS_TIMEOUT_MS,
): Promise<SafeDestination> {
  if (url.username || url.password) throw new Error("Unsafe crawler destination.");
  const hostname = networkHost(url.hostname);
  if (!hostname || hostname === "localhost") {
    throw new Error("Unsafe crawler destination.");
  }

  if (net.isIP(hostname)) {
    if (isUnsafeIp(hostname)) {
      throw new Error("Unsafe crawler destination.");
    }
    return { address: hostname, family: net.isIP(hostname) as 4 | 6 };
  }

  if (
    !hostname
      .split(".")
      .every((label) =>
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
      )
  ) {
    throw new Error("Unsafe crawler destination.");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Crawler DNS resolution timed out.")), dnsTimeoutMs);
  });
  const addresses = await Promise.race([lookup(hostname, { all: true }), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  if (
    !addresses.length ||
    addresses.some((entry) => {
      const family = net.isIP(entry.address);
      return (family !== 4 && family !== 6) || family !== entry.family || isUnsafeIp(entry.address);
    })
  ) {
    throw new Error("Unsafe crawler destination.");
  }
  const approved = addresses.map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 }))
    .sort((left, right) => left.family - right.family || left.address.localeCompare(right.address));
  const selected = approved[0]!;
  return { ...selected, addresses: approved };
}

type SafeHttpResponse = { status: number; ok: boolean; headers: Headers; body: ReadableStream<Uint8Array> };
type SafeRequest = (url: URL, options: { signal: AbortSignal; headers: Record<string, string> }) => Promise<SafeHttpResponse>;

async function requestSafeDestination(url: URL, options: { signal: AbortSignal; headers: Record<string, string> }): Promise<SafeHttpResponse> {
  const approved = await assertSafeDestination(url);
  return new Promise<SafeHttpResponse>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "GET",
      headers: options.headers,
      signal: options.signal,
      agent: false,
      lookup: (_hostname, lookupOptions, callback) => {
        if (typeof lookupOptions === "object" && lookupOptions.all) callback(null, approved.addresses ?? [{ address: approved.address, family: approved.family }]);
        else (callback as unknown as (error: null, address: string, family: number) => void)(null, approved.address, approved.family);
      },
    }, (response) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(name, item);
        else if (value !== undefined) headers.set(name, value);
      }
      resolve({
        status: response.statusCode ?? 0,
        ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
        headers,
        body: Readable.toWeb(response) as ReadableStream<Uint8Array>,
      });
    });
    request.on("error", reject);
    request.end();
  });
}

class ResponseLimitError extends Error { constructor(message: string, readonly bytesRead = 0) { super(message); } }

async function cancelBody(body: ReadableStream<Uint8Array>): Promise<void> {
  try { await body.cancel(); } catch { /* Response cleanup cannot hide the crawl outcome. */ }
}

function recordUnsafeDestination(error: unknown, restrictions: CrawlRestriction[], url: URL): void {
  if (error instanceof Error && error.message === "Unsafe crawler destination.") {
    restrictions.push({ type: "unsafe_destination", url: url.toString() });
  }
}

async function readBoundedBody(body: ReadableStream<Uint8Array>, maximumBytes: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) throw new ResponseLimitError("Crawler response exceeds the download limit.", length);
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* Cancellation must not hide the read failure. */ }
    throw error;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function dedupeUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.search = "";
  if (parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }
  return parsed.toString();
}

function isDocumentOrAsset(url: URL): boolean {
  const extension = url.pathname.split(".").at(-1)?.toLowerCase();
  return Boolean(extension && IGNORED_EXTENSIONS.has(extension));
}

function isPdfUrl(url: URL): boolean {
  return /\.pdf$/i.test(url.pathname);
}

function isEligiblePdf(url: URL, discoveryText = ""): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { /* Retain encoded path. */ }
  const queryValues = Array.from(url.searchParams.values()).map((value) => {
    try { return decodeURIComponent(value); } catch { return value; }
  });
  const pdfSignal = isPdfUrl(url) || queryValues.some((value) => /\.pdf$/i.test(value)) || (/\bpdf\b/i.test(discoveryText) && PDF_DURABLE_SIGNAL.test(discoveryText));
  if (!pdfSignal) return false;
  const evidence = `${path.replace(/[/.]+/g, " ")} ${queryValues.join(" ")} ${discoveryText}`;
  return PDF_DURABLE_SIGNAL.test(evidence) && !PDF_EDITORIAL_SIGNAL.test(evidence);
}

type FetchedPdf = { bytes: Uint8Array; resolvedUrl: URL; truncated: boolean; redirectChain?:string[];contentType?:string;fetchedAt?:string };
type ParsedPdf = { text: string; title?: string; pagesParsed: number; truncated: boolean; pages?:{pageNumber:number;text:string}[] };
class PdfSkippedError extends Error { constructor(message: string, readonly truncated = false, readonly bytesDownloaded = 0) { super(message); } }
type PdfFetchOutcome =
  | { status: "success"; document: FetchedPdf; bytesDownloaded?: number }
  | { status: "skipped"; truncated?: boolean; bytesDownloaded?: number }
  | { status: "failed"; bytesDownloaded?: number };

async function fetchPdf(url: URL, restrictions: CrawlRestriction[]): Promise<PdfFetchOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PDF_LIMITS.fetchTimeoutMs);
  try {
    let current = url;
    const redirectChain:string[]=[];
    const originalHost = normalizeHost(url.hostname);
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      if ((current.protocol !== "http:" && current.protocol !== "https:") || normalizeHost(current.hostname) !== originalHost) {
        restrictions.push({ type: "redirect_blocked", url: current.toString() });
        return { status: "skipped" };
      }
      let response: SafeHttpResponse;
      try { response = await requestSafeDestination(current, { signal: controller.signal, headers: { accept: "application/pdf,application/octet-stream;q=0.5", "user-agent": "AIBuilderWebsiteCrawler/1.0" } }); }
      catch (error) { recordUnsafeDestination(error, restrictions, current); throw error; }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await cancelBody(response.body);
        if (!location || redirects === MAX_REDIRECTS) { restrictions.push({ type: "redirect_blocked", url: current.toString(), status: response.status }); return { status: "skipped" }; }
        redirectChain.push(current.toString()); current = new URL(location, current);
        continue;
      }
      if (!response.ok) { await cancelBody(response.body); return { status: "failed" }; }
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > PDF_LIMITS.bytes) {
        restrictions.push({ type: "response_too_large", url: current.toString(), status: response.status });
        await cancelBody(response.body);
        throw new PdfSkippedError("PDF exceeds the download limit.", true);
      }
      let bytes: Uint8Array;
      try { bytes = await readBoundedBody(response.body, PDF_LIMITS.bytes); }
      catch (error) {
        if (error instanceof ResponseLimitError) {
          restrictions.push({ type: "response_too_large", url: current.toString(), status: response.status });
          throw new PdfSkippedError("PDF exceeds the download limit.", true, error.bytesRead);
        }
        throw error;
      }
      const signature = bytes.length >= 5 && new TextDecoder("ascii").decode(bytes.subarray(0, 5)) === "%PDF-";
      const type = (response.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
      if (!signature || (type !== "application/pdf" && type !== "application/octet-stream" && type !== "binary/octet-stream")) {
        restrictions.push({ type: "unsupported_content_type", url: current.toString(), status: response.status });
        return { status: "skipped", bytesDownloaded: bytes.byteLength };
      }
      return { status: "success", document: { bytes, resolvedUrl: current, truncated: false, redirectChain, contentType:type, fetchedAt:new Date().toISOString() }, bytesDownloaded: bytes.byteLength };
    }
    return { status: "skipped" };
  } catch (error) {
    if (error instanceof PdfSkippedError) return { status: "skipped", truncated: error.truncated, bytesDownloaded: error.bytesDownloaded };
    return { status: "failed" };
  } finally { clearTimeout(timeout); }
}

function dedupePdfUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  return parsed.toString();
}

async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  // The dependency is loaded only when an eligible PDF survives discovery.
  // @ts-ignore The package is installed in deployed builds; CI may install production dependencies separately.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { task.destroy(); reject(new Error("PDF parsing timed out.")); }, PDF_LIMITS.parseTimeoutMs); });
  try {
    const extraction = (async () => {
      const document = await task.promise;
      const pageLimit = Math.min(document.numPages, PDF_LIMITS.pages);
      const lines: string[] = []; const pages:{pageNumber:number;text:string}[]=[];
      let characters = 0;
      for (let number = 1; number <= pageLimit && characters < PDF_LIMITS.characters; number += 1) {
        const page = await document.getPage(number);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: unknown) =>
          typeof item === "object" && item !== null && "str" in item && typeof item.str === "string"
            ? item.str
            : "",
        ).join(" ");
        const remaining=Math.max(0,PDF_LIMITS.characters-characters);
        const boundedPageText=pageText.slice(0,remaining);
        lines.push(boundedPageText); pages.push({pageNumber:number,text:boundedPageText}); characters += boundedPageText.length + 2;
      }
      const metadata = await document.getMetadata().catch(() => null);
      const raw = lines.join("\n\n").replace(/\0/g, "").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      const text = raw.length > PDF_LIMITS.characters ? raw.slice(0, PDF_LIMITS.characters).replace(/\s+\S*$/s, "").trim() : raw;
      const info = metadata?.info;
      const title = info && typeof info === "object" && "Title" in info && typeof info.Title === "string" ? info.Title : undefined;
      return { text, title, pagesParsed: lines.length, truncated: document.numPages > lines.length || raw.length > PDF_LIMITS.characters, pages };
    })();
    return await Promise.race([extraction, timeout]);
  } finally { if (timer) clearTimeout(timer); await task.destroy(); }
}

function pdfFilenameTitle(url: URL): string {
  let filename = url.pathname.split("/").at(-1)?.replace(/\.pdf$/i, "") ?? "Document";
  try { filename = decodeURIComponent(filename); } catch { /* Retain encoded filename. */ }
  return filename.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Document";
}

function normalizeDiscoveryPath(url: URL): string {
  let pathname = url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { /* Keep malformed escapes encoded. */ }
  return `/${pathname.toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "")}`;
}

function isDiscoverableBusinessUrl(url: URL, discoveryText = ""): boolean {
  const path = normalizeDiscoveryPath(url);
  const segments = path.split("/").filter(Boolean);
  if (segments.some((segment) => EDITORIAL_PATH_SEGMENT.test(segment))) return false;
  if (segments.length > 1 && YEAR_PATH_SEGMENT.test(segments[0] ?? "")) return false;

  void discoveryText;
  return true;
}

export async function fetchHtml(
  url: URL,
  restrictions: CrawlRestriction[],
  initialDestinationValidated = false,
  requestResource: SafeRequest = requestSafeDestination,
): Promise<{ html: string; resolvedUrl: URL; redirectChain?:string[];contentType?:string;fetchedAt?:string } | null> {
  // Kept for dependency compatibility; the socket-level request always repeats
  // validation so an earlier check can never substitute for address pinning.
  void initialDestinationValidated;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = url; const redirectChain:string[]=[];

    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        restrictions.push({type:"unsupported_protocol",url:current.toString()});
        return null;
      }
      let response: SafeHttpResponse;
      try {
        response = await requestResource(current, { signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml", "user-agent": "AIBuilderWebsiteCrawler/1.0" } });
      } catch (error) { recordUnsafeDestination(error, restrictions, current); throw error; }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await cancelBody(response.body);
        if (!location || redirectCount === MAX_REDIRECTS) { restrictions.push({type:"redirect_blocked",url:current.toString(),status:response.status}); return null; }
        redirectChain.push(current.toString()); current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) restrictions.push({type:"access_denied",url:current.toString(),status:response.status});
        if (response.status === 429) restrictions.push({type:"rate_limited",url:current.toString(),status:response.status});
        await cancelBody(response.body);
        return null;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !contentType.toLowerCase().includes("text/html")
      ) {
        restrictions.push({type:"unsupported_content_type",url:current.toString(),status:response.status});
        await cancelBody(response.body);
        return null;
      }
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
        restrictions.push({ type: "response_too_large", url: current.toString(), status: response.status });
        await cancelBody(response.body);
        throw new ResponseLimitError("Crawler response exceeds the download limit.");
      }

      let bytes: Uint8Array;
      try { bytes = await readBoundedBody(response.body, MAX_HTML_BYTES); }
      catch (error) {
        if (error instanceof ResponseLimitError) restrictions.push({ type: "response_too_large", url: current.toString(), status: response.status });
        throw error;
      }
      const html = new TextDecoder().decode(bytes);
      return { html, resolvedUrl: current, redirectChain, contentType:contentType.split(";",1)[0]||"text/html", fetchedAt:new Date().toISOString() };
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSitemapXml(
  url: URL,
  restrictions: CrawlRestriction[],
  requestResource: SafeRequest = requestSafeDestination,
): Promise<{ xml: string; resolvedUrl: URL } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = url;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      if (current.protocol !== "http:" && current.protocol !== "https:") return null;
      let response: SafeHttpResponse;
      try {
        response = await requestResource(current, { signal: controller.signal, headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1", "user-agent": "AIBuilderWebsiteCrawler/1.0" } });
      } catch (error) { recordUnsafeDestination(error, restrictions, current); throw error; }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await cancelBody(response.body);
        if (!location || redirectCount === MAX_REDIRECTS) return null;
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) { await cancelBody(response.body); return null; }
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_HTML_BYTES) {
        restrictions.push({ type: "response_too_large", url: current.toString(), status: response.status });
        await cancelBody(response.body);
        throw new ResponseLimitError("Crawler response exceeds the download limit.");
      }

      try {
        return { xml: new TextDecoder().decode(await readBoundedBody(response.body, MAX_HTML_BYTES)), resolvedUrl: current };
      } catch (error) {
        if (error instanceof ResponseLimitError) restrictions.push({ type: "response_too_large", url: current.toString(), status: response.status });
        throw error;
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value: string): string {
  const codePoint = (raw: string, radix: number) => {
    const parsed = Number.parseInt(raw, radix);
    const validWhitespace = parsed === 0x09 || parsed === 0x0a || parsed === 0x0d;
    const disallowedControl = (parsed >= 0 && parsed < 0x20 && !validWhitespace) || (parsed >= 0x7f && parsed <= 0x9f);
    const nonCharacter = (parsed >= 0xfdd0 && parsed <= 0xfdef) || (parsed & 0xfffe) === 0xfffe;
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0x10ffff && !(parsed >= 0xd800 && parsed <= 0xdfff) && !disallowedControl && !nonCharacter
      ? String.fromCodePoint(parsed)
      : "�";
  };
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => codePoint(code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => codePoint(code, 16));
}

type SemanticDiagnostics = { headingsRetained:number; paragraphsRetained:number; listItemsRetained:number; tablesRetained:number; tableRowsRetained:number; definitionEntriesRetained:number; visibleFaqsRetained:number; hiddenElementsIgnored:number; semanticBlocksDeduplicated:number; extractionOutputTruncated:number };
type HtmlNode = { tag:string; attrs:string; children:HtmlNode[]; text:string };

/** A deliberately small HTML tree builder: extraction needs document relationships, not browser layout. */
function semanticHtml(html: string): { text:string; h1:string; diagnostics:SemanticDiagnostics } {
  const diagnostics: SemanticDiagnostics = { headingsRetained:0, paragraphsRetained:0, listItemsRetained:0, tablesRetained:0, tableRowsRetained:0, definitionEntriesRetained:0, visibleFaqsRetained:0, hiddenElementsIgnored:0, semanticBlocksDeduplicated:0, extractionOutputTruncated:0 };
  const root:HtmlNode={tag:"root",attrs:"",children:[],text:""}; const stack=[root]; let nodes=0;
  const voidTags=new Set(["br","hr","img","meta","link","input","source","area","base","embed","param","track","wbr"]);
  for (const token of html.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+/g) ?? []) {
    if (++nodes > SEMANTIC_LIMITS.nodes) { diagnostics.extractionOutputTruncated=1; break; }
    if (token.startsWith("<!--") || /^<!/i.test(token)) continue;
    if (token.startsWith("</")) { const tag=token.match(/^<\/\s*([\w:-]+)/)?.[1]?.toLowerCase(); if (!tag) continue; for(let i=stack.length-1;i>0;i--) if(stack[i]?.tag===tag){stack.length=i;break;} continue; }
    if (token.startsWith("<")) {
      const match=token.match(/^<\s*([\w:-]+)([\s\S]*?)\/?\s*>$/); if(!match) continue;
      const node:HtmlNode={tag:(match[1]??"").toLowerCase(),attrs:match[2]??"",children:[],text:""}; stack.at(-1)!.children.push(node);
      if(!voidTags.has(node.tag)&&!token.endsWith("/>")&&stack.length<=SEMANTIC_LIMITS.depth) stack.push(node); else if(stack.length>SEMANTIC_LIMITS.depth) diagnostics.extractionOutputTruncated=1;
    } else stack.at(-1)!.children.push({tag:"#",attrs:"",children:[],text:decodeHtml(token)});
  }
  const attr=(node:HtmlNode,name:string)=>decodeHtml(node.attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:(["'])(.*?)\\1|([^\\s>]+))`,"i"))?.[2] ?? node.attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:(["'])(.*?)\\1|([^\\s>]+))`,"i"))?.[3] ?? "");
  const hidden=(node:HtmlNode)=>/(?:^|\s)(?:hidden|inert)(?:\s|=|$)/i.test(node.attrs)||attr(node,"aria-hidden").toLowerCase()==="true"||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(node,"style"));
  const ignored=new Set(["script","style","svg","template","canvas","noscript"]);
  const plain=(node:HtmlNode, depth=0):string => depth>SEMANTIC_LIMITS.depth||hidden(node)||ignored.has(node.tag)?"":node.tag==="#"?node.text:node.children.map(child=>plain(child,depth+1)).join(" ").replace(/\s+/g," ").trim();
  const blocks:string[]=[]; const keys=new Set<string>(); const faqKeys=new Set<string>(); let h1=""; let lists=0,totalItems=0,tables=0,definitions=0,faqs=0;
  const add=(value:string, kind?:"heading"|"paragraph"|"list"|"table"|"definition"|"faq")=>{const indent=kind==="list"&&/^\s{2}/.test(value)?"  ":"";value=indent+value.replace(/\s+/g," ").trim();if(!value.trim())return false;if(blocks.length>=SEMANTIC_LIMITS.blocks){diagnostics.extractionOutputTruncated=1;return false;} const key=normalizeText(value); if(keys.has(key)){diagnostics.semanticBlocksDeduplicated++;return false;} keys.add(key); blocks.push(value); if(kind==="heading")diagnostics.headingsRetained++; if(kind==="paragraph")diagnostics.paragraphsRetained++;return true;};
  const listText=(node:HtmlNode)=>node.children.filter(child=>child.tag!=="ul"&&child.tag!=="ol").map(child=>plain(child)).join(" ").replace(/\s+/g," ").trim();
  const emitFaq=(question:string,answer:string)=>{question=question.replace(/^question\s*:\s*/i,"").trim();answer=answer.replace(/^answer\s*:\s*/i,"").trim();const key=`${normalizeText(question)}|${normalizeText(answer)}`;if(!question||!answer||faqKeys.has(key))return false;if(faqs>=SEMANTIC_LIMITS.faqs||blocks.length>SEMANTIC_LIMITS.blocks-2){diagnostics.extractionOutputTruncated=1;return false;}faqKeys.add(key);add(`Question: ${question}`,"faq");add(`Answer: ${answer}`,"faq");faqs++;diagnostics.visibleFaqsRetained++;return true;};
  const emitList=(node:HtmlNode,level=0):number=>{
    const items=node.children.filter(child=>child.tag==="li");
    const nav=/^(nav|navigation|menu)$/i.test(attr(node,"role"))||(items.length>3&&items.every(li=>li.children.some(child=>child.tag==="a")&&listText(li).split(" ").length<6));
    if(nav)return 0;
    if(lists>=SEMANTIC_LIMITS.lists){diagnostics.extractionOutputTruncated=1;return 0;}
    lists++; let emitted=0; let number=Number.parseInt(attr(node,"start"),10); if(!Number.isFinite(number))number=1; const local=new Set<string>();
    for(const li of items){
      if(emitted>=SEMANTIC_LIMITS.itemsPerList||totalItems>=SEMANTIC_LIMITS.listItems){diagnostics.extractionOutputTruncated=1;break;}
      const explicit=Number.parseInt(attr(li,"value"),10);if(node.tag==="ol"&&Number.isFinite(explicit))number=explicit;
      const value=listText(li),key=normalizeText(value);if(value&&!local.has(key)){local.add(key);if(add(`${level?"  ":""}${node.tag==="ol"?`${number}.`:"-"} ${value}`,"list")){emitted++;totalItems++;diagnostics.listItemsRetained++;}}
      if(node.tag==="ol")number++;
      for(const nested of li.children.filter(child=>child.tag==="ul"||child.tag==="ol"))emitted+=emitList(nested,Math.min(1,level+1));
    }
    return emitted;
  };
  const tableRows=(node:HtmlNode):{rows:string[];truncated:boolean}=>{
    const grid:string[]=[];const spans=new Map<string,string>();const sourceRows=find(node,"tr");let truncated=sourceRows.length>SEMANTIC_LIMITS.tableRows;
    for(let rowIndex=0;rowIndex<Math.min(sourceRows.length,SEMANTIC_LIMITS.tableRows);rowIndex++){
      const row:string[]=[];let column=0;const fillSpans=()=>{while(column<SEMANTIC_LIMITS.tableColumns){const span=spans.get(`${rowIndex}:${column}`);if(!span)break;row[column++]=span;}};fillSpans();
      const cells=sourceRows[rowIndex]!.children.filter(child=>child.tag==="th"||child.tag==="td");if(cells.length>SEMANTIC_LIMITS.tableColumns)truncated=true;
      for(const cell of cells){fillSpans();if(column>=SEMANTIC_LIMITS.tableColumns)break;const value=plain(cell).slice(0,SEMANTIC_LIMITS.cell);const colspan=Math.min(SEMANTIC_LIMITS.tableColumns-column,Math.max(1,Number.parseInt(attr(cell,"colspan"),10)||1));const rowspan=Math.min(SEMANTIC_LIMITS.tableRows-rowIndex,Math.max(1,Number.parseInt(attr(cell,"rowspan"),10)||1));for(let offset=0;offset<colspan;offset++){row[column+offset]=value;if(rowspan>1)for(let down=1;down<rowspan;down++)spans.set(`${rowIndex+down}:${column+offset}`,value);}column+=colspan;}
      fillSpans();if(row.some(Boolean))grid.push(row.slice(0,SEMANTIC_LIMITS.tableColumns).map(value=>value??"").join(" | ").replace(/(?: \| )+$/,""));
    }return {rows:grid,truncated};
  };
  const walk=(node:HtmlNode,depth=0,inSpecial=false):void=>{
    if(depth>SEMANTIC_LIMITS.depth){diagnostics.extractionOutputTruncated=1;return;} if(hidden(node)){diagnostics.hiddenElementsIgnored++;return;} if(ignored.has(node.tag))return;
    if(/cookie|consent/i.test(`${attr(node,"id")} ${attr(node,"class")}`)&&/(?:button|dialog|banner|controls?)/i.test(`${node.tag} ${attr(node,"role")} ${attr(node,"class")}`))return;
    if (/^h[1-6]$/.test(node.tag)) { const value=plain(node); if(node.tag==="h1"&&!h1)h1=value; if(diagnostics.headingsRetained>=SEMANTIC_LIMITS.headings)diagnostics.extractionOutputTruncated=1;else add(value,"heading"); return; }
    if(node.tag==="p"){if(diagnostics.paragraphsRetained>=SEMANTIC_LIMITS.paragraphs)diagnostics.extractionOutputTruncated=1;else add(plain(node),"paragraph");return;}
    if((node.tag==="ul"||node.tag==="ol")&&!inSpecial){emitList(node);return;}
    if(node.tag==="table"&&!inSpecial){const extracted=tableRows(node),rows=extracted.rows;const combined=rows.join(" ");const hasHeaders=find(node,"th").some(cell=>Boolean(plain(cell)));const business=/(?:hours?|price|cost|fee|plan|service|feature|specification|model|location|address|policy|availability|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\$|€|£)/i.test(combined);const comparison=hasHeaders&&rows.length>=2&&rows.some(row=>/\d|yes|no|included|available/i.test(row));const rejected=/^(?:presentation|none)$/i.test(attr(node,"role"))||rows.length===0||(!business&&!comparison);if(!rejected){if(tables>=SEMANTIC_LIMITS.tables)diagnostics.extractionOutputTruncated=1;else{tables++;if(extracted.truncated)diagnostics.extractionOutputTruncated=1;let retainedRows=0;for(const row of rows)if(add(row,"table"))retainedRows++;if(retainedRows){diagnostics.tablesRetained++;diagnostics.tableRowsRetained+=retainedRows;}}}return;}
    if(node.tag==="dl"&&!inSpecial){let term="";for(const child of node.children){if(child.tag==="dt")term=plain(child);else if(child.tag==="dd"&&term){const desc=plain(child);if(!desc)continue;if(/\?$/.test(term)||/faq/i.test(attr(node,"class")))emitFaq(term,desc);else if(definitions>=SEMANTIC_LIMITS.definitions)diagnostics.extractionOutputTruncated=1;else if(add(`${term}: ${desc}`,"definition")){definitions++;diagnostics.definitionEntriesRetained++;}}}return;}
    if(node.tag==="details"&&!inSpecial){const summary=node.children.find(x=>x.tag==="summary");const question=summary?plain(summary):"";const answer=node.children.filter(x=>x!==summary).map(x=>plain(x)).join(" ").trim();emitFaq(question,answer);return;}
    if(!inSpecial){
      const questionNode=node.children.find(child=>/(?:^|[-_\s])(?:faq-?)?question(?:[-_\s]|$)/i.test(attr(child,"class")));
      const answerNode=node.children.find(child=>/(?:^|[-_\s])(?:faq-?)?answer(?:[-_\s]|$)/i.test(attr(child,"class")));
      if(questionNode&&answerNode&&emitFaq(plain(questionNode),plain(answerNode)))return;
      for(let index=0;index<node.children.length-1;index++){const question=node.children[index]!,answer=node.children[index+1]!;if(/^h[2-6]$/.test(question.tag)&&/\?\s*$/.test(plain(question))&&/^(?:p|div|section)$/.test(answer.tag)&&emitFaq(plain(question),plain(answer)))return;}
    }
    if (/^(?:div|section|article|main|header|footer|nav|aside|body)$/.test(node.tag)) {
      const hasSemanticDescendant=find(node,"p").length+find(node,"ul").length+find(node,"ol").length+find(node,"table").length+find(node,"dl").length+find(node,"details").length+find(node,"h1").length+find(node,"h2").length+find(node,"h3").length>0;
      if(!hasSemanticDescendant){if(diagnostics.paragraphsRetained>=SEMANTIC_LIMITS.paragraphs)diagnostics.extractionOutputTruncated=1;else add(plain(node),"paragraph");return;}
    }
    for(const child of node.children)walk(child,depth+1,inSpecial);
  };
  function find(node:HtmlNode,tag:string):HtmlNode[]{const result:HtmlNode[]=[];const visit=(n:HtmlNode,d:number)=>{if(d>SEMANTIC_LIMITS.depth)return;if(n.tag===tag)result.push(n);for(const child of n.children)visit(child,d+1);};visit(node,0);return result;}
  walk(root); let text=blocks.join("\n"); if(text.length>SEMANTIC_LIMITS.text){text=text.slice(0,SEMANTIC_LIMITS.text).replace(/\s+\S*$/s,"").trim();diagnostics.extractionOutputTruncated=1;} return{text,h1,diagnostics};
}

type JsonLdExtraction = {
  text: string;
  blocksDetected: number;
  blocksParsed: number;
  malformedBlocks: number;
  entitiesDetected: number;
  factsRetained: number;
  factsDeduplicated: number;
};

const SUPPORTED_STRUCTURED_TYPES = new Set([
  "organization", "localbusiness", "corporation", "professionalservice", "store",
  "product", "service", "offer", "aggregateoffer", "faqpage", "question", "answer",
  "person", "postaladdress", "openinghoursspecification", "contactpoint", "review",
  "aggregaterating",
]);

const LOCAL_BUSINESS_SUBTYPES = new Set([
  "restaurant", "dentist", "plumber", "electrician", "attorney", "autorepair", "hotel",
  "medicalclinic", "realestateagent", "accountingservice", "automotivebusiness", "bakery",
  "barorpub", "beautysalon", "cafeorcoffeeshop", "childcare", "dayspa", "drycleaningorlaundry",
  "emergencyservice", "employmentagency", "entertainmentbusiness", "financialservice", "foodestablishment",
  "governmentoffice", "healthandbeautybusiness", "homeandconstructionbusiness", "insuranceagency",
  "legalservice", "library", "lodgingbusiness", "movingcompany", "notary", "professionalservice",
  "radiostation", "recyclingcenter", "selfstorage", "shoppingcenter", "sportsactivitylocation",
  "televisionstation", "touristinformationcenter", "travelagency", "veterinarycare", "bikestore",
  "bookstore", "clothingstore", "computerstore", "conveniencestore", "departmentstore", "electronicsstore",
  "florist", "furniturestore", "gardenstore", "grocerystore", "hardwarestore", "hobbystore", "homestore",
  "jewelrystore", "liquorstore", "mensclothingstore", "mobilestore", "moviestore", "musicstore",
  "officeequipmentstore", "outletstore", "pawnshop", "petstore", "shoestore", "sportinggoodsstore",
  "tireshop", "toystore", "wholesalestore",
]);

function structuredScalar(value: unknown, depth = 0): string {
  if (depth > 3 || value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized.slice(0, MAX_STRUCTURED_VALUE);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => structuredScalar(item, depth + 1)).filter(Boolean).join(", ").slice(0, MAX_STRUCTURED_VALUE);
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return structuredScalar(object.name ?? object.description ?? object.text ?? object.value ?? object.price ?? object.ratingValue ?? object["@id"], depth + 1);
  }
  return "";
}

function structuredUrls(value: unknown): string[] {
  const pending = Array.isArray(value) ? value.slice(0, MAX_STRUCTURED_URLS * 2) : [value];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of pending) {
    const raw = typeof item === "object" && item && !Array.isArray(item)
      ? structuredScalar((item as Record<string, unknown>)["@id"])
      : structuredScalar(item);
    try {
      const parsed = new URL(raw);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !seen.has(parsed.toString())) {
        seen.add(parsed.toString()); urls.push(parsed.toString().slice(0, MAX_STRUCTURED_VALUE));
      }
    } catch { /* Unsupported and malformed URLs are not evidence. */ }
    if (urls.length >= MAX_STRUCTURED_URLS) break;
  }
  return urls;
}

function extractJsonLd(html: string): JsonLdExtraction {
  const result: JsonLdExtraction = { text: "", blocksDetected: 0, blocksParsed: 0, malformedBlocks: 0, entitiesDetected: 0, factsRetained: 0, factsDeduplicated: 0 };
  const facts: string[] = [];
  const factKeys = new Set<string>();
  let visitedItems = 0;
  const add = (label: string, value: unknown) => {
    if (facts.length >= MAX_STRUCTURED_FACTS) return;
    const display = structuredScalar(value);
    if (!display || /^(?:null|undefined|unknown|n\/a)$/i.test(display)) return;
    const line = `${label}: ${display}`;
    const key = normalizeText(line);
    if (factKeys.has(key)) { result.factsDeduplicated += 1; return; }
    if (facts.join("\n").length + line.length + 1 > MAX_STRUCTURED_TEXT) return;
    factKeys.add(key); facts.push(line);
  };
  const addUrls = (label: string, value: unknown) => {
    for (const url of structuredUrls(value)) add(label, url);
  };
  const entitiesById = new Map<string, Record<string, unknown>>();
  let indexedItems = 0;
  const indexEntities = (value: unknown, depth: number) => {
    if (depth > MAX_JSON_LD_DEPTH || indexedItems >= MAX_JSON_LD_ITEMS || value == null) return;
    if (Array.isArray(value)) { for (const item of value) indexEntities(item, depth + 1); return; }
    if (typeof value !== "object") return;
    indexedItems += 1;
    const entity = value as Record<string, unknown>;
    const id = typeof entity["@id"] === "string" ? entity["@id"].trim() : "";
    if (id && !entitiesById.has(id)) entitiesById.set(id, entity);
    for (const nested of Object.values(entity)) if (nested && typeof nested === "object") indexEntities(nested, depth + 1);
  };
  const visit = (value: unknown, depth: number) => {
    if (depth > MAX_JSON_LD_DEPTH || visitedItems >= MAX_JSON_LD_ITEMS || value == null) return;
    if (Array.isArray(value)) { for (const item of value.slice(0, MAX_JSON_LD_ITEMS - visitedItems)) visit(item, depth + 1); return; }
    if (typeof value !== "object") return;
    visitedItems += 1;
    const entity = value as Record<string, unknown>;
    const types = (Array.isArray(entity["@type"]) ? entity["@type"] : [entity["@type"]]).map((type) => String(type ?? "").toLowerCase());
    const supported = types.some((type) => SUPPORTED_STRUCTURED_TYPES.has(type) || LOCAL_BUSINESS_SUBTYPES.has(type));
    if (supported) {
      result.entitiesDetected += 1;
      const isPerson = types.includes("person");
      const isProduct = types.includes("product");
      const isService = types.includes("service") || types.includes("professionalservice");
      const isQuestion = types.includes("question");
      const isAnswer = types.includes("answer");
      add(isPerson ? "Person name" : isProduct ? "Product name" : isService ? "Service name" : "Business name", entity.name);
      add("Legal name", entity.legalName); add("Description", entity.description);
      addUrls("URL", entity.url); addUrls("Logo", entity.logo); add("Founded", entity.foundingDate); add("Slogan", entity.slogan);
      add("Parent organization", entity.parentOrganization); add("Brand", entity.brand);
      add("Telephone", entity.telephone); add("Email", entity.email); add("Contact type", entity.contactType);
      const address = entity.address && typeof entity.address === "object" && !Array.isArray(entity.address) ? entity.address as Record<string, unknown> : undefined;
      if (address) add("Address", [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode, address.addressCountry].map(structuredScalar).filter(Boolean).join(", "));
      add("Street address", entity.streetAddress); add("Locality", entity.addressLocality); add("Region", entity.addressRegion); add("Postal code", entity.postalCode); add("Country", entity.addressCountry);
      add("Area served", entity.areaServed ?? entity.serviceArea); add("Opening hours", entity.openingHours);
      if (types.includes("openinghoursspecification")) add("Opening hours", `${structuredScalar(entity.dayOfWeek)} ${structuredScalar(entity.opens)}-${structuredScalar(entity.closes)}`.trim());
      add("Category", entity.category); add("Model", entity.model); add("SKU", entity.sku); add("Audience", entity.audience); add("Provider", entity.provider); add("Service type", entity.serviceType);
      add("Price", entity.price); add("Low price", entity.lowPrice); add("High price", entity.highPrice); add("Price currency", entity.priceCurrency); add("Availability", entity.availability); add("Eligible region", entity.eligibleRegion); add("Price specification", entity.priceSpecification); add("Minimum quantity", entity.eligibleQuantity ?? entity.minimumQuantity);
      if (isQuestion) {
        add("FAQ question", entity.name ?? entity.text);
        const answers = Array.isArray(entity.acceptedAnswer) ? entity.acceptedAnswer : [entity.acceptedAnswer];
        for (const answer of answers.slice(0, 20)) {
          const referenced = answer && typeof answer === "object" && !Array.isArray(answer) ? entitiesById.get(String((answer as Record<string, unknown>)["@id"] ?? "")) : undefined;
          add("FAQ answer", referenced ?? answer);
        }
      }
      if (isAnswer) add("FAQ answer", entity.text ?? entity.name);
      add("Job title", entity.jobTitle); add("Works for", entity.worksFor); add("Affiliation", entity.affiliation);
      add("Review body", entity.reviewBody); add("Review author", entity.author); add(types.includes("aggregaterating") ? "Aggregate rating" : "Rating value", entity.ratingValue); add("Review count", entity.reviewCount); add("Rating count", entity.ratingCount);
      addUrls("External profile", entity.sameAs);
    }
    for (const nested of Object.values(entity)) if (nested && typeof nested === "object") visit(nested, depth + 1);
  };
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html))) {
    const attributes = match[1] ?? "";
    const type = attributes.match(/\btype\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i);
    if ((type?.[2] ?? type?.[3] ?? "").trim().toLowerCase() !== "application/ld+json") continue;
    result.blocksDetected += 1;
    try { const parsed: unknown = JSON.parse((match[2] ?? "").trim()); result.blocksParsed += 1; indexEntities(parsed, 0); visit(parsed, 0); }
    catch { result.malformedBlocks += 1; }
  }
  result.factsRetained = facts.length;
  if (facts.length) result.text = `Structured business data:\n${facts.join("\n")}`;
  return result;
}

function extractLinkRelations(html: string, pageUrl: URL, baseHost: string) {
  let canonical: string | undefined;
  const alternates: { url: string; language: string }[] = [];
  let ignoredAlternates = 0;
  const pattern = /<link\b([^>]*?)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const attributes = match[1] ?? "";
    const attribute = (name: string) => decodeHtml(attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2] ?? "").trim();
    const rel = attribute("rel").toLowerCase().split(/\s+/);
    const href = attribute("href");
    if (!href) continue;
    let parsed: URL;
    try { parsed = new URL(href, pageUrl); } catch { continue; }
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || normalizeHost(parsed.hostname) !== baseHost || isDocumentOrAsset(parsed) || !isAllowedPageUrl(parsed)) { if (rel.includes("alternate")) ignoredAlternates += 1; continue; }
    const url = dedupeUrl(parsed.toString());
    if (rel.includes("canonical") && !canonical) canonical = url;
    if (rel.includes("alternate")) alternates.push({ url, language: attribute("hreflang").toLowerCase() });
  }
  return { canonical, alternates, ignoredAlternates };
}

function isAllowedPageUrl(url: URL): boolean {
  const segments = normalizeDiscoveryPath(url).split("/").filter(Boolean);
  return !segments.some((segment) => EDITORIAL_PATH_SEGMENT.test(segment)) && !(segments.length > 1 && YEAR_PATH_SEGMENT.test(segments[0] ?? ""));
}

function normalizeText(value: string): string {
  return value.replace(/https?:\/\/\S+/gi, (raw) => { try { const url = new URL(raw); url.search = ""; return url.toString(); } catch { return raw; } })
    .toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function textBlocks(text: string): { text: string; key: string; protected: boolean }[] {
  return text.split(/\n+/).map((block) => block.trim()).filter(Boolean).map((text) => ({
    text,
    key: normalizeText(text),
    protected: /(?:\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b|\b(?:hours|address|emergency|after-hours?|contact)\b|mailto:|tel:|[\w.+-]+@[\w.-]+\.\w{2,}|\+?\d[\d\s().-]{6,})/i.test(text),
  })).filter((block) => Boolean(block.key));
}

function shingles(value: string): Set<string> {
  const tokens = value.split(" ").filter(Boolean);
  const result = new Set<string>();
  for (let index = 0; index <= tokens.length - 5; index += 1) result.add(tokens.slice(index, index + 5).join(" "));
  return result;
}

function similarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  left.forEach((item) => { if (right.has(item)) overlap += 1; });
  return overlap / Math.min(left.size, right.size);
}

function extractTitle(html: string, h1: string, url: URL): string {
  const clean=(value:string)=>decodeHtml(value.replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim().slice(0,200);
  const meaningful=(value:string)=>value&&!/^(?:home|welcome|untitled|new page)$/i.test(value);
  const metadata=(name:string)=>{
    const pattern=/<meta\b([^>]+)>/gi;
    let match:RegExpExecArray|null;
    while((match=pattern.exec(html))!==null){
      const attrs=match[1]??"";
      const key=attrs.match(/(?:property|name)\s*=\s*(["'])(.*?)\1/i)?.[2]?.toLowerCase();
      if(key===name)return clean(attrs.match(/content\s*=\s*(["'])(.*?)\1/i)?.[2]??"");
    }
    return"";
  };
  const candidates=[clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??""),clean(h1),metadata("og:title"),metadata("twitter:title")];
  const selected=candidates.find(meaningful); if(selected)return selected;
  const rawSegment=url.pathname.split("/").filter(Boolean).at(-1)??"";let decodedSegment=rawSegment;try{decodedSegment=decodeURIComponent(rawSegment);}catch{/* Preserve malformed escapes as visible source text. */}
  const segment=decodedSegment.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  return clean(segment)||normalizeHost(url.hostname);
}

function inferPageType(url: URL, title: string): string {
  const value = `${url.pathname} ${title}`.toLowerCase();
  if (/faq|frequently asked/.test(value)) return "faq";
  if (/pricing|price|package|plan/.test(value)) return "pricing";
  if (/service|solution/.test(value)) return "services";
  if (/product/.test(value)) return "products";
  if (/about|company|story|team/.test(value)) return "about";
  if (/contact|get-in-touch|connect/.test(value)) return "contact";
  if (/policy|terms|privacy|refund|return/.test(value)) return "policy";
  if (url.pathname === "/" || !url.pathname) return "home";
  return "other";
}

function discoverInternalLinks(
  html: string,
  pageUrl: URL,
  baseHost: string,
): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const anchorPattern =
    /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const rawHref = decodeHtml(match[2] ?? "").trim();
    const anchorText = decodeHtml(
      (match[3] ?? "").replace(/<[^>]+>/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (
      !rawHref ||
      rawHref.startsWith("#") ||
      /^(mailto|tel|javascript):/i.test(rawHref)
    ) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawHref, pageUrl);
    } catch {
      continue;
    }

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      normalizeHost(parsed.hostname) !== baseHost
    ) {
      continue;
    }

    if (isEligiblePdf(parsed, anchorText) || isDocumentOrAsset(parsed)) continue;

    if (!isDiscoverableBusinessUrl(parsed, anchorText)) continue;

    const normalized = dedupeUrl(parsed.toString());
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  return links;
}

function discoverPdfLinks(html: string, pageUrl: URL, baseHost: string): string[] {
  const links = new Set<string>();
  const pattern = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    let parsed: URL;
    try { parsed = new URL(decodeHtml(match[2] ?? "").trim(), pageUrl); } catch { continue; }
    const anchor = decodeHtml((match[3] ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && normalizeHost(parsed.hostname) === baseHost && isEligiblePdf(parsed, anchor)) links.add(dedupePdfUrl(parsed.toString()));
  }
  return Array.from(links);
}

function extractSitemapLocations(xml: string): {
  type: "index" | "urlset";
  locations: string[];
} | null {
  const root = xml.match(/<(?:[\w.-]+:)?(sitemapindex|urlset)\b/i)?.[1]?.toLowerCase();
  if (root !== "sitemapindex" && root !== "urlset") return null;

  const locations: string[] = [];
  const locationPattern = /<(?:[\w.-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?loc\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = locationPattern.exec(xml)) !== null) {
    const location = decodeHtml((match[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
    if (location) locations.push(location);
  }
  return { type: root === "sitemapindex" ? "index" : "urlset", locations };
}

export async function crawlBusinessWebsite(
  websiteUrl: string,
  onPage?: (completedPages: number, discoveredPages: number) => void,
  dependencies: {
    fetchPage?: typeof fetchHtml;
    fetchSitemap?: typeof fetchSitemapXml;
    fetchPdf?: (url: URL, restrictions: CrawlRestriction[]) => Promise<PdfFetchOutcome | FetchedPdf | null>;
    parsePdf?: typeof parsePdf;
    assertSafe?: DestinationSafetyCheck;
    now?: () => number;
    renderPage?: (url: URL, timeoutMs: number, signal?: AbortSignal) => Promise<RenderedHtml | null>;
    createBrowserRenderer?: (assertSafe: DestinationSafetyCheck, baseHost: string, renderHost?: string) => Promise<BrowserRenderer>;
    browserLimits?: Partial<BrowserLimits>;
    crawlAttemptId?: string;
    crawlStartedAt?: string;
  } = {},
): Promise<BusinessWebsiteCrawlResult> {
  const now = dependencies.now ?? (() => performance.now());
  const fetchPage = dependencies.fetchPage ?? fetchHtml;
  const fetchSitemap = dependencies.fetchSitemap ?? fetchSitemapXml;
  const fetchPdfDocument = dependencies.fetchPdf ?? fetchPdf;
  const parsePdfDocument = dependencies.parsePdf ?? parsePdf;
  const assertSafe = dependencies.assertSafe ?? assertSafeDestination;
  const browserLimits: BrowserLimits = { ...BROWSER_LIMITS, ...dependencies.browserLimits };
  const totalStarted = now();
  const crawlAttemptId = dependencies.crawlAttemptId ?? crypto.randomUUID();
  const crawlStartedAt = dependencies.crawlStartedAt ?? new Date().toISOString();
  const timings: BusinessWebsiteCrawlTimings = { initialUrlResolutionMs: 0, homepageFetchMs: 0, sitemapDiscoveryMs: 0, pageDiscoveryMs: 0, pageCrawlingMs: 0, pdfFetchMs: 0, pdfParseMs: 0, contentExtractionMs: 0, totalCrawlDurationMs: 0 };
  const duplicateDiagnostics = { canonicalUrlsDetected: 0, canonicalDuplicatesSkipped: 0, redirectDuplicatesSkipped: 0, exactDuplicatesSkipped: 0, nearDuplicatesSkipped: 0, alternateVariantsSkipped: 0, alternateLinksRejected: 0, alternateLinksNotSelected: 0, alternatePagesDeduplicated: 0, repeatedBoilerplateOccurrencesDiscounted: 0 };
  const structuredDiagnostics = { jsonLdBlocksDetected: 0, jsonLdBlocksParsed: 0, malformedJsonLdBlocksIgnored: 0, supportedStructuredEntitiesDetected: 0, structuredFactsRetained: 0, structuredFactsDeduplicated: 0 };
  const semanticDiagnostics: SemanticDiagnostics = { headingsRetained:0, paragraphsRetained:0, listItemsRetained:0, tablesRetained:0, tableRowsRetained:0, definitionEntriesRetained:0, visibleFaqsRetained:0, hiddenElementsIgnored:0, semanticBlocksDeduplicated:0, extractionOutputTruncated:0 };
  const sitemapDiagnostics = { sitemapsDiscovered:0, sitemapFetchAttempted:0, sitemapsFetched:0, sitemapsParsed:0, sitemapsRejected:0, sitemapsFailed:0 };
  const pdfDiagnostics = { pdfsDiscovered:0, pdfFetchAttempted:0, pdfsFetched:0, pdfParseAttempted:0, pdfsParsed:0, pdfsRetained:0, pdfsSkipped:0, pdfsFailed:0, pdfBytesDownloaded:0, pdfPagesParsed:0, pdfDocumentsTruncated:0 };
  const browserDiagnostics = { browserPagesQueued:0, browserRenderAttempts:0, browserPagesRendered:0, browserPagesSkipped:0, browserRenderFailures:0, browserRenderTimeouts:0, browserFallbacksUsed:0, browserRenderDurationMs:0 };
  const emptyDiagnostics = (restrictions: CrawlRestriction[]): BusinessWebsiteCrawlDiagnostics => ({pagesDiscovered:0,pagesProcessed:0,pagesFetchAttempted:0,pagesFetched:0,pagesFetchRejected:0,pagesExtractionAttempted:0,pagesExtractionSucceeded:0,pagesRetained:0,pagesSkipped:0,pagesFailed:0,pagesExtractionFailed:0,...sitemapDiagnostics,...pdfDiagnostics,...browserDiagnostics,...duplicateDiagnostics,...structuredDiagnostics,...semanticDiagnostics,finalUrls:[],restrictions,warningDetails:[],timings:{...timings,totalCrawlDurationMs:Math.max(0,now()-totalStarted)}});
  let requested: URL;
  try { requested = normalizeWebsiteCrawlInput(websiteUrl); } catch (error) {
    const message=error instanceof Error?error.message:"Invalid website URL.";
    const restrictions:CrawlRestriction[]=message.includes("http or https")?[{type:"unsupported_protocol",url:websiteUrl.slice(0,500)}]:[];
    throw new BusinessWebsiteCrawlError(message,emptyDiagnostics(restrictions));
  }
  const restrictions: CrawlRestriction[] = [];
  const requestedEntry = new URL(requested);
  const originRoot = new URL("/", requested.origin);
  const resolutionStarted = now();
  try { await assertSafe(requestedEntry); } catch (error) {
    timings.initialUrlResolutionMs = Math.max(0, now() - resolutionStarted);
    restrictions.push({type:"unsafe_destination",url:requested.toString()});
    throw new BusinessWebsiteCrawlError(error instanceof Error?error.message:"Unsafe crawler destination.",emptyDiagnostics(restrictions));
  }
  timings.initialUrlResolutionMs = Math.max(0, now() - resolutionStarted);

  const warnings: string[] = [];
  const warningDetails: CrawlWarning[] = [];
  const warn = (warning: CrawlWarning) => {
    if (!warnings.includes(warning.message)) warnings.push(warning.message);
    if (!warningDetails.some((item) => item.stage === warning.stage && item.url === warning.url && item.message === warning.message)) warningDetails.push(warning);
  };
  const pages: CrawledBusinessPage[] = [];
  let pagesSkipped = 0;
  let pagesFailed = 0;
  let pagesExtractionFailed = 0;
  let pagesFetched = 0;
  let pagesFetchRejected = 0;
  let pagesExtractionAttempted = 0;
  let pagesExtractionSucceeded = 0;
  let homepageResolved = requestedEntry;
  let homepageHtml = "";
  let pageFetchAttempts = 0;
  const homepageStarted = now();
  try {
    pageFetchAttempts += 1;
    const homepage = await fetchPage(requestedEntry, restrictions, true);
    if (homepage) { pagesFetched += 1; homepageResolved = homepage.resolvedUrl; homepageHtml = homepage.html; }
    else pagesFailed += 1;
  } catch (error) {
    pagesFailed += 1;
    const message = error instanceof Error ? error.message : "Unknown crawl error";
    warn({ stage:"homepage_fetch", message, url:requestedEntry.toString() });
  }
  timings.homepageFetchMs = Math.max(0, now() - homepageStarted);

  const baseHost = normalizeHost(homepageResolved.hostname);
  const queue: string[] = [];
  const queued = new Set<string>();
  const visited = new Set<string>();
  const discoveredHtmlUrls = new Set<string>([dedupeUrl(requestedEntry.toString())]);
  const finalUrls = new Set<string>();
  const sitemapDiscovered = new Set<string>();
  const pdfCandidates = new Set<string>();
  const pdfDiscovery=new Map<string,{method:WebsiteDiscoveryMethod;parent:string|null}>();
  const addPdfCandidate = (url: string,method:WebsiteDiscoveryMethod="pdf_link",parent:string|null=null) => { if (!pdfCandidates.has(url)) { pdfCandidates.add(url);pdfDiscovery.set(url,{method,parent}); pdfDiagnostics.pdfsDiscovered += 1; } };
  const localizedUrls = new Set<string>();
  type RetainedPage = { page: CrawledBusinessPage; finalUrl: string; identity: string; priority: number; blocks: ReturnType<typeof textBlocks>; structuredFacts: number; semantic:SemanticDiagnostics; sourceDocument:WebsiteSourceDocumentRecord; sourceBlocks:WebsiteSourceBlockRecord[] };
  const retained: RetainedPage[] = [];
  const discovery = new Map<string,{method:WebsiteDiscoveryMethod;parent:string|null}>([[dedupeUrl(requestedEntry.toString()),{method:"submitted",parent:null}]]);
  const blockCounts = new Map<string, number>();
  let preferredLanguage = (requested.searchParams.get("lang") ?? "").toLowerCase();
  const syncPages = () => { pages.splice(0, pages.length, ...retained.map((record) => record.page)); };
  const reportPageProgress = () => {
    try { onPage?.(retained.filter((record) => record.page.pageType !== "document").length, discoveredHtmlUrls.size); }
    catch { /* Progress observers cannot change crawl retention or failure state. */ }
  };
  const meaningfulFor = (record: Pick<RetainedPage, "blocks">) => normalizeText(record.blocks
    .filter((block) => block.protected || (blockCounts.get(block.key) ?? 0) < 3)
    .map((block) => block.text).join(" "));
  const enqueue = (value: string, front = false, alreadyClassified = false, method:WebsiteDiscoveryMethod="unknown", parent:string|null=null) => {
    let parsed: URL;
    try { parsed = new URL(value); } catch { return; }
    if (!alreadyClassified && !isDiscoverableBusinessUrl(parsed)) return;
    const normalized = dedupeUrl(parsed.toString());
    discoveredHtmlUrls.add(normalized);
    if (!discovery.has(normalized)) discovery.set(normalized,{method,parent});
    if (!visited.has(normalized) && !queued.has(normalized)) { queued.add(normalized); front ? queue.unshift(normalized) : queue.push(normalized); }
  };
  const normalizeSitemapPage = (value: string, sitemapUrl: URL): string | null => {
    let parsed: URL;
    try { parsed = new URL(value, sitemapUrl); } catch { return null; }
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      normalizeHost(parsed.hostname) !== baseHost
    ) return null;
    if (isEligiblePdf(parsed)) { addPdfCandidate(dedupePdfUrl(parsed.toString()),"sitemap",sitemapUrl.toString()); return null; }
    if (isDocumentOrAsset(parsed) || !isDiscoverableBusinessUrl(parsed)) return null;
    const normalized = dedupeUrl(parsed.toString());
    sitemapDiscovered.add(normalized);
    return normalized;
  };
  const discoverSitemapPages = async () => {
    const pending = [new URL("/sitemap.xml", homepageResolved.origin)];
    const seenSitemaps = new Set<string>();
    const discoveredPages = new Set<string>();

    while (pending.length > 0 && seenSitemaps.size < MAX_SITEMAP_FETCHES) {
      const sitemapUrl = pending.shift()!;
      const normalizedSitemapUrl = dedupeUrl(sitemapUrl.toString());
      if (seenSitemaps.has(normalizedSitemapUrl)) continue;
      seenSitemaps.add(normalizedSitemapUrl);
      sitemapDiagnostics.sitemapsDiscovered += 1;
      sitemapDiagnostics.sitemapFetchAttempted += 1;

      try {
        const fetched = await fetchSitemap(sitemapUrl, restrictions);
        if (!fetched || normalizeHost(fetched.resolvedUrl.hostname) !== baseHost) { sitemapDiagnostics.sitemapsRejected += 1; continue; }
        sitemapDiagnostics.sitemapsFetched += 1;
        const parsed = extractSitemapLocations(fetched.xml);
        if (!parsed) { sitemapDiagnostics.sitemapsRejected += 1; continue; }
        sitemapDiagnostics.sitemapsParsed += 1;

        if (parsed.type === "urlset") {
          for (const location of parsed.locations) {
            const pageUrl = normalizeSitemapPage(location, fetched.resolvedUrl);
            if (pageUrl) discoveredPages.add(pageUrl);
          }
          continue;
        }

        for (const location of parsed.locations) {
          let child: URL;
          try { child = new URL(location, fetched.resolvedUrl); } catch { continue; }
          if (
            (child.protocol === "http:" || child.protocol === "https:") &&
            normalizeHost(child.hostname) === baseHost &&
            !seenSitemaps.has(dedupeUrl(child.toString()))
          ) pending.push(child);
        }
      } catch {
        sitemapDiagnostics.sitemapsFailed += 1;
        // Sitemap discovery is opportunistic; HTML discovery remains the fallback.
      }
    }
    return Array.from(discoveredPages);
  };
  const protectedBlocks = new Set<string>();
  let renderer: BrowserRenderer | undefined;
  let browserAttempts = 0;
  let browserTimeUsed = 0;
  class BrowserRenderTimeout extends Error {}
  const weakHtml = (html: string) => {
    const semantic = semanticHtml(html);
    const structured = extractJsonLd(html);
    const blocks = semantic.diagnostics.headingsRetained + semantic.diagnostics.paragraphsRetained + semantic.diagnostics.listItemsRetained + semantic.diagnostics.tableRowsRetained + semantic.diagnostics.definitionEntriesRetained + semantic.diagnostics.visibleFaqsRetained;
    return structured.factsRetained === 0 && semantic.text.length < 160 && blocks <= 3;
  };
  const materiallyImproves = (original: string, rendered: string) => {
    const before = semanticHtml(original), after = semanticHtml(rendered);
    const beforeFacts = extractJsonLd(original).factsRetained, afterFacts = extractJsonLd(rendered).factsRetained;
    return after.text.length >= 80 && ((after.text.length >= before.text.length + 120 && after.text.length >= before.text.length * 1.5) || afterFacts >= beforeFacts + 2);
  };
  const maybeRender = async (fetched: RenderedHtml): Promise<RenderedHtml> => {
    if (!weakHtml(fetched.html)) return fetched;
    browserDiagnostics.browserPagesQueued += 1;
    if (browserAttempts >= browserLimits.pages || browserTimeUsed >= browserLimits.totalTimeMs) { browserDiagnostics.browserPagesSkipped += 1; return fetched; }
    browserAttempts += 1;
    browserDiagnostics.browserRenderAttempts += 1;
    const remaining = browserLimits.totalTimeMs - browserTimeUsed;
    const timeoutMs = Math.min(browserLimits.renderTimeoutMs, remaining);
    const started = now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const renderController = new AbortController();
    let renderPromise: Promise<RenderedHtml | null> | undefined;
    try {
      const render = dependencies.renderPage ?? (renderer ??= await (dependencies.createBrowserRenderer
        ? dependencies.createBrowserRenderer(assertSafe, baseHost, fetched.resolvedUrl.hostname)
        : createPlaywrightRenderer(assertSafe, baseHost, undefined, fetched.resolvedUrl.hostname))).render;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { renderController.abort(); reject(new BrowserRenderTimeout()); }, timeoutMs);
      });
      renderPromise = render(new URL(fetched.resolvedUrl), timeoutMs, renderController.signal);
      const rendered = await Promise.race([renderPromise, timeout]);
      if (!rendered) { browserDiagnostics.browserPagesSkipped += 1; return fetched; }
      browserDiagnostics.browserPagesRendered += 1;
      if ((rendered.resolvedUrl.protocol !== "http:" && rendered.resolvedUrl.protocol !== "https:") || normalizeHost(rendered.resolvedUrl.hostname) !== baseHost) throw new Error("Invalid rendered destination");
      await assertSafe(rendered.resolvedUrl);
      if (new TextEncoder().encode(rendered.html).byteLength > MAX_HTML_BYTES) {
        restrictions.push({ type: "response_too_large", url: rendered.resolvedUrl.toString() });
        throw new ResponseLimitError("Rendered page exceeds the extraction limit.");
      }
      if (!materiallyImproves(fetched.html, rendered.html)) { browserDiagnostics.browserPagesSkipped += 1; return fetched; }
      browserDiagnostics.browserFallbacksUsed += 1;
      return rendered;
    } catch (error) {
      if (error instanceof BrowserRenderTimeout) {
        browserDiagnostics.browserRenderTimeouts += 1;
        renderController.abort();
        if (renderPromise) {
          let drainTimer: ReturnType<typeof setTimeout> | undefined;
          const drained = await Promise.race([
            renderPromise.then(() => true, () => true),
            new Promise<false>((resolve) => { drainTimer = setTimeout(() => resolve(false), BROWSER_CANCELLATION_GRACE_MS); }),
          ]);
          if (drainTimer) clearTimeout(drainTimer);
          if (!drained && renderer) {
            try { await renderer.close(); } catch { /* Timed-out renderer disposal is best effort. */ }
            renderer = undefined;
          }
        }
      }
      else browserDiagnostics.browserRenderFailures += 1;
      const warning = "A JavaScript-rendered page could not be processed.";
      warn({ stage:"browser_render", message:warning, url:fetched.resolvedUrl.toString() });
      return fetched;
    } finally {
      if (timer) clearTimeout(timer);
      const duration = Math.max(0, now() - started);
      browserTimeUsed += duration;
      browserDiagnostics.browserRenderDurationMs += duration;
    }
  };
  const processFetched = async (fetched: { html: string; resolvedUrl: URL;redirectChain?:string[];contentType?:string;fetchedAt?:string }) => {
      const sourceHtml=fetched.html; const staticMetadata=fetched;
      fetched = await maybeRender(fetched);
      const wasRendered=fetched.html!==sourceHtml;
      const finalUrl = dedupeUrl(fetched.resolvedUrl.toString());
      if (finalUrls.has(finalUrl)) { pagesSkipped += 1; duplicateDiagnostics.redirectDuplicatesSkipped += 1; return; }
      finalUrls.add(finalUrl);
      const relations = extractLinkRelations(fetched.html, fetched.resolvedUrl, baseHost);
      duplicateDiagnostics.alternateVariantsSkipped += relations.ignoredAlternates;
      duplicateDiagnostics.alternateLinksRejected += relations.ignoredAlternates;
      const safeRelation = async (value: string | undefined) => {
        if (!value) return undefined;
        try { await assertSafe(new URL(value)); return value; } catch { return undefined; }
      };
      const canonical = await safeRelation(relations.canonical);
      if (canonical) duplicateDiagnostics.canonicalUrlsDetected += 1;
      const identity = canonical ?? finalUrl;
      const semantic = semanticHtml(fetched.html);
      const text = semantic.text;
      const title = extractTitle(fetched.html, semantic.h1, fetched.resolvedUrl);
      const structured = extractJsonLd(fetched.html);
      structuredDiagnostics.jsonLdBlocksDetected += structured.blocksDetected;
      structuredDiagnostics.jsonLdBlocksParsed += structured.blocksParsed;
      structuredDiagnostics.malformedJsonLdBlocksIgnored += structured.malformedBlocks;
      structuredDiagnostics.supportedStructuredEntitiesDetected += structured.entitiesDetected;
      structuredDiagnostics.structuredFactsDeduplicated += structured.factsDeduplicated;
      // Titles participate in duplicate meaning (as they did in the legacy visible-text
      // extractor), while structured data remains deliberately excluded.
      const duplicateTitle = /<title\b[^>]*>[\s\S]*?<\/title>/i.test(fetched.html) || semantic.h1 ? title : "";
      const blocks = textBlocks(`${duplicateTitle}\n${text}`);
      const pageBlockKeys = new Set<string>();
      for (const block of blocks) {
        if (block.protected) protectedBlocks.add(block.key);
        pageBlockKeys.add(block.key);
      }
      pageBlockKeys.forEach((key) => blockCounts.set(key, (blockCounts.get(key) ?? 0) + 1));
      duplicateDiagnostics.repeatedBoilerplateOccurrencesDiscounted = Array.from(blockCounts).reduce((total, [key, count]) =>
        total + (count >= 3 && !protectedBlocks.has(key) ? count : 0), 0);
      const discoveryStarted = now();
      for (const pdf of discoverPdfLinks(fetched.html, fetched.resolvedUrl, baseHost)) addPdfCandidate(pdf,"pdf_link",fetched.resolvedUrl.toString());
      timings.pageDiscoveryMs += Math.max(0, now() - discoveryStarted);
      if (text.length < 80) { pagesSkipped += 1; return; }
      const pageType = inferPageType(fetched.resolvedUrl, title);
      const core = pageType !== "other";
      const supplementary = /\/(?:guides?|docs?|documentation|help|case-stud(?:y|ies)|resources?|academy)(?:\/|$)/i.test(fetched.resolvedUrl.pathname);
      const localized = localizedUrls.has(finalUrl);
      const actualCanonicalDestination = finalUrl === identity;
      const priority = (core ? 10_000 : supplementary ? 300 : 100) + (actualCanonicalDestination ? 1_000 : 0) + (sitemapDiscovered.has(finalUrl) && core ? 500 : 0) + Math.max(0, 200 - new URL(identity).pathname.length) - (localized ? 200 : 0);
      const retainedText = structured.text ? `${text}\n\n${structured.text}` : text;
      const htmlLanguage = (fetched.html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)/i)?.[1] ?? "").toLowerCase();
      const sourceHash=sha256(wasRendered?fetched.html:sourceHtml); const actualFetchedUrl=fetched.resolvedUrl.toString(); const sourceDocumentId=stableSourceDocumentId(crawlAttemptId,actualFetchedUrl,sourceHash);
      const discovered=discovery.get(dedupeUrl(fetched.resolvedUrl.toString()))??(retained.length===0?{method:"submitted" as const,parent:null}:{method:"unknown" as const,parent:null});
      const renderRedirect=wasRendered&&staticMetadata.resolvedUrl.toString()!==actualFetchedUrl?[staticMetadata.resolvedUrl.toString()]:[];
      const sourceDocument:WebsiteSourceDocumentRecord={schemaVersion:1,id:sourceDocumentId,crawlAttemptId,actualFetchedUrl,canonicalUrl:canonical??null,redirectChain:[...(staticMetadata.redirectChain??[]),...renderRedirect],sourceType:wasRendered?"rendered_html":"html",contentType:wasRendered?"text/html":staticMetadata.contentType??"text/html",status:"retained",fetchedAt:wasRendered?new Date().toISOString():staticMetadata.fetchedAt??new Date().toISOString(),sourceContentHash:sourceHash,extractedContentHash:sha256(retainedText),language:htmlLanguage||null,sourceTruncated:false,extractionTruncated:Boolean(semantic.diagnostics.extractionOutputTruncated),discoveryMethod:discovered.method,discoveredFromUrl:discovered.parent};
      const visibleBlocks=buildTextBlocks({documentId:sourceDocumentId,attemptId:crawlAttemptId,text,method:"semantic_html",preserveWhole:true});
      const jsonBlocks=structured.text?buildTextBlocks({documentId:sourceDocumentId,attemptId:crawlAttemptId,text:structured.text.replace(/^Structured business data:\n/,""),method:"json_ld",type:"json_ld_fact"}):[];
      const candidate: RetainedPage = { page: { url: identity, title, pageType, text: retainedText, sourceDocumentId }, finalUrl, identity, priority, blocks, structuredFacts: structured.factsRetained, semantic:semantic.diagnostics,sourceDocument,sourceBlocks:visibleBlocks.concat(jsonBlocks) };

      const htmlDiscoveryStarted = now();
      for (const discovered of discoverInternalLinks(fetched.html, fetched.resolvedUrl, baseHost).reverse()) enqueue(discovered, true, true,"html_link",finalUrl);
      timings.pageDiscoveryMs += Math.max(0, now() - htmlDiscoveryStarted);

      if (!preferredLanguage && retained.length === 0) preferredLanguage = htmlLanguage || (relations.alternates.some((item) => item.language === "x-default") ? "x-default" : "");
      const preferredAlternate = relations.alternates.find((item) => preferredLanguage && (item.language === preferredLanguage || (preferredLanguage !== "x-default" && item.language.split("-")[0] === preferredLanguage.split("-")[0])))
        ?? (preferredLanguage === "x-default" ? relations.alternates.find((item) => item.language === "x-default") : undefined);
      for (const alternate of relations.alternates) {
        const safeAlternate = await safeRelation(alternate.url);
        if (!safeAlternate) { duplicateDiagnostics.alternateVariantsSkipped += 1; duplicateDiagnostics.alternateLinksRejected += 1; continue; }
        if (alternate !== preferredAlternate || safeAlternate === identity || localizedUrls.size >= 1) { duplicateDiagnostics.alternateVariantsSkipped += 1; duplicateDiagnostics.alternateLinksNotSelected += 1; continue; }
        localizedUrls.add(safeAlternate);
        enqueue(safeAlternate, true, true,"alternate",finalUrl);
      }

      let duplicate = retained.find((record) => record.identity === identity);
      let duplicateKind: "canonical" | "exact" | "near" | undefined = duplicate ? "canonical" : undefined;
      if (!duplicate) {
        const candidateMeaningful = meaningfulFor(candidate);
        const fingerprint = createHash("sha256").update(candidateMeaningful).digest("hex");
        duplicate = retained.find((record) => createHash("sha256").update(meaningfulFor(record)).digest("hex") === fingerprint);
        duplicateKind = duplicate ? "exact" : undefined;
        if (!duplicate && candidateMeaningful.split(" ").length >= 20) {
          const candidateShingles = shingles(candidateMeaningful);
          duplicate = retained.find((record) => similarity(shingles(meaningfulFor(record)), candidateShingles) >= 0.92);
          duplicateKind = duplicate ? "near" : undefined;
        }
      }
      if (duplicate && duplicateKind) {
        pagesSkipped += 1;
        if (localized) { duplicateDiagnostics.alternateVariantsSkipped += 1; duplicateDiagnostics.alternatePagesDeduplicated += 1; }
        else if (duplicateKind === "canonical") duplicateDiagnostics.canonicalDuplicatesSkipped += 1;
        else if (duplicateKind === "exact") duplicateDiagnostics.exactDuplicatesSkipped += 1;
        else duplicateDiagnostics.nearDuplicatesSkipped += 1;
        if (priority <= duplicate.priority) return;
        retained.splice(retained.indexOf(duplicate), 1, candidate);
        syncPages();
        reportPageProgress();
        return;
      }
      retained.push(candidate);
      syncPages();
      reportPageProgress();
  };
  const processFetchedSafely = async (fetched: { html: string; resolvedUrl: URL;redirectChain?:string[];contentType?:string;fetchedAt?:string }) => {
    pagesExtractionAttempted += 1;
    const extractionStarted = now();
    try { await processFetched(fetched); pagesExtractionSucceeded += 1; }
    catch {
      try { finalUrls.delete(dedupeUrl(fetched.resolvedUrl.toString())); } catch { /* Invalid failure inputs have no retained identity. */ }
      pagesExtractionFailed += 1;
      const warning = "A page was fetched but its content could not be extracted.";
      warn({ stage:"html_extraction", message:warning, url:fetched.resolvedUrl.toString() });
    } finally { timings.contentExtractionMs += Math.max(0, now() - extractionStarted); }
  };

  try {
  if (dedupeUrl(originRoot.toString()) !== dedupeUrl(requestedEntry.toString())) enqueue(originRoot.toString(), false, true,"priority_path",requestedEntry.toString());
  for (const path of PRIORITY_PATHS.slice(1)) enqueue(new URL(path, homepageResolved.origin).toString(),false,false,"priority_path",homepageResolved.toString());
  if (homepageHtml) await processFetchedSafely({ html: homepageHtml, resolvedUrl: homepageResolved });
  const sitemapStarted = now();
  const sitemapPages = await discoverSitemapPages();
  timings.sitemapDiscoveryMs += Math.max(0, now() - sitemapStarted);
  for (const sitemapPage of sitemapPages) enqueue(sitemapPage,false,false,"sitemap",new URL("/sitemap.xml",homepageResolved.origin).toString());

  while (queue.length > 0 && pageFetchAttempts < MAX_PAGES) {
    const batch: URL[] = [];
    while (
      queue.length &&
      batch.length < MAX_CONCURRENT_FETCHES &&
      batch.length < MAX_PAGES - pageFetchAttempts
    ) {
      const nextUrl = queue.shift()!;
      queued.delete(nextUrl);
      if (visited.has(nextUrl)) continue;
      visited.add(nextUrl);
      try {
        const parsed = new URL(nextUrl);
        if (normalizeHost(parsed.hostname) !== baseHost || isDocumentOrAsset(parsed)) { pagesSkipped += 1; continue; }
        batch.push(parsed);
      } catch { pagesSkipped += 1; }
    }
    if (!batch.length) continue;
    pageFetchAttempts += batch.length;
    const crawlStarted = now();
    const fetchedBatch = await Promise.all(batch.map(async (parsed) => {
      try { return { parsed, fetched: await fetchPage(parsed, restrictions), error: null }; }
      catch (error) { return { parsed, fetched: null, error }; }
    }));
    timings.pageCrawlingMs += Math.max(0, now() - crawlStarted);
    for (const { parsed, fetched, error } of fetchedBatch) {
      if (!fetched) {
        if (error) {
          pagesFailed += 1;
          const message = error instanceof Error ? error.message : "Unknown crawl error";
          warn({ stage:"html_fetch", message, url:parsed.toString() });
        } else {
          // A clean no-document outcome (404, unsupported content, blocked redirect,
          // or another policy rejection) is a skip, not an operational fetch failure.
          pagesFetchRejected += 1;
        }
        continue;
      }
      pagesFetched += 1;
      await processFetchedSafely(fetched);
    }
  }

  // PDFs are intentionally supplemental: they receive their own budget only after
  // the bounded HTML crawl has completed.
  for (const candidateUrl of Array.from(pdfCandidates).slice(0, PDF_LIMITS.documents)) {
    pdfDiagnostics.pdfFetchAttempted += 1;
    const pdfFetchStarted = now();
    let outcome: PdfFetchOutcome | FetchedPdf | null;
    try {
      outcome = await fetchPdfDocument(new URL(candidateUrl), restrictions);
    } catch (error) {
      timings.pdfFetchMs += Math.max(0, now() - pdfFetchStarted);
      pdfDiagnostics.pdfsFailed += 1;
      warn({ stage:"pdf_fetch", message:"A PDF document could not be read.", url:candidateUrl });
      continue;
    }
    timings.pdfFetchMs += Math.max(0, now() - pdfFetchStarted);
    try {
      if (!outcome) { pdfDiagnostics.pdfsFailed += 1; warn({ stage:"pdf_fetch", message:"A PDF document could not be read.", url:candidateUrl }); continue; }
      if ("status" in outcome) pdfDiagnostics.pdfBytesDownloaded += outcome.bytesDownloaded ?? (outcome.status === "success" ? outcome.document.bytes.byteLength : 0);
      if ("status" in outcome && outcome.status !== "success") {
        if (outcome.status === "skipped") { pdfDiagnostics.pdfsSkipped += 1; if (outcome.truncated) pdfDiagnostics.pdfDocumentsTruncated += 1; }
        else { pdfDiagnostics.pdfsFailed += 1; warn({ stage:"pdf_fetch", message:"A PDF document could not be read.", url:candidateUrl }); }
        continue;
      }
      const fetched = "status" in outcome ? outcome.document : outcome;
      if (!("status" in outcome)) pdfDiagnostics.pdfBytesDownloaded += fetched.bytes.byteLength;
      pdfDiagnostics.pdfsFetched += 1;
      if (normalizeHost(fetched.resolvedUrl.hostname) !== baseHost || (fetched.resolvedUrl.protocol !== "http:" && fetched.resolvedUrl.protocol !== "https:")) {
        pdfDiagnostics.pdfsSkipped += 1;
        restrictions.push({ type:"redirect_blocked", url:fetched.resolvedUrl.toString() });
        continue;
      }
      const finalUrl = dedupeUrl(fetched.resolvedUrl.toString());
      if (finalUrls.has(finalUrl)) { pdfDiagnostics.pdfsSkipped += 1; continue; }
      finalUrls.add(finalUrl);
      pdfDiagnostics.pdfParseAttempted += 1;
      const pdfParseStarted = now();
      let parsed: ParsedPdf;
      try { parsed = await parsePdfDocument(fetched.bytes); }
      catch (error) {
        timings.pdfParseMs += Math.max(0, now() - pdfParseStarted);
        pdfDiagnostics.pdfsFailed += 1;
        warn({ stage:"pdf_parse", message:"A PDF document could not be read.", url:fetched.resolvedUrl.toString() });
        continue;
      }
      timings.pdfParseMs += Math.max(0, now() - pdfParseStarted);
      pdfDiagnostics.pdfsParsed += 1;
      pdfDiagnostics.pdfPagesParsed += Math.min(parsed.pagesParsed, PDF_LIMITS.pages);
      if (fetched.truncated || parsed.truncated || parsed.pagesParsed > PDF_LIMITS.pages || parsed.text.length > PDF_LIMITS.characters) pdfDiagnostics.pdfDocumentsTruncated += 1;
      const text = parsed.text.replace(/\0/g, "").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, PDF_LIMITS.characters).trim();
      if (text.length < PDF_LIMITS.minimumCharacters) { pdfDiagnostics.pdfsSkipped += 1; continue; }
      const metadataTitle = (parsed.title ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim();
      const title = metadataTitle.length >= 3 && !/^(?:untitled|document|microsoft word)$/i.test(metadataTitle) ? metadataTitle.slice(0, 300) : pdfFilenameTitle(fetched.resolvedUrl);
      const blocks = textBlocks(text);
      const sourceHash=sha256(fetched.bytes); const actualFetchedUrl=fetched.resolvedUrl.toString(); const sourceDocumentId=stableSourceDocumentId(crawlAttemptId,actualFetchedUrl,sourceHash);
      const pdfOrigin=pdfDiscovery.get(candidateUrl)??{method:"unknown" as const,parent:null};
      const sourceDocument:WebsiteSourceDocumentRecord={schemaVersion:1,id:sourceDocumentId,crawlAttemptId,actualFetchedUrl,canonicalUrl:null,redirectChain:fetched.redirectChain??[],sourceType:"pdf",contentType:fetched.contentType??"application/pdf",status:"retained",fetchedAt:fetched.fetchedAt??new Date().toISOString(),sourceContentHash:sourceHash,extractedContentHash:sha256(text),language:null,sourceTruncated:Boolean(fetched.truncated),extractionTruncated:Boolean(parsed.truncated||parsed.pagesParsed>PDF_LIMITS.pages||parsed.text.length>PDF_LIMITS.characters),discoveryMethod:pdfOrigin.method,discoveredFromUrl:pdfOrigin.parent};
      let remainingBlockCharacters=PDF_LIMITS.characters;
      const sourceBlocks=(parsed.pages?.length?parsed.pages:[{pageNumber:1,text}]).flatMap(page=>{
        if(remainingBlockCharacters<=0)return [];
        const boundedPageText=page.text.slice(0,remainingBlockCharacters);
        remainingBlockCharacters-=boundedPageText.length;
        return buildTextBlocks({documentId:sourceDocumentId,attemptId:crawlAttemptId,text:boundedPageText,method:"pdf_text",type:"pdf_page_text",pageNumber:page.pageNumber,preserveWhole:true});
      });
      const candidate: RetainedPage = { page:{ url:finalUrl, title, pageType:"document", text, sourceDocumentId }, finalUrl, identity:finalUrl, priority:10, blocks, structuredFacts:0, semantic:{headingsRetained:0,paragraphsRetained:0,listItemsRetained:0,tablesRetained:0,tableRowsRetained:0,definitionEntriesRetained:0,visibleFaqsRetained:0,hiddenElementsIgnored:0,semanticBlocksDeduplicated:0,extractionOutputTruncated:0},sourceDocument,sourceBlocks };
      const meaningful = normalizeText(text);
      const fingerprint = createHash("sha256").update(meaningful).digest("hex");
      let duplicate = retained.find((record) => createHash("sha256").update(meaningfulFor(record)).digest("hex") === fingerprint);
      let near = false;
      if (!duplicate && meaningful.split(" ").length >= 20) { const candidateShingles = shingles(meaningful); duplicate = retained.find((record) => similarity(shingles(meaningfulFor(record)), candidateShingles) >= 0.92); near = Boolean(duplicate); }
      if (duplicate) { pdfDiagnostics.pdfsSkipped += 1; if (near) duplicateDiagnostics.nearDuplicatesSkipped += 1; else duplicateDiagnostics.exactDuplicatesSkipped += 1; continue; }
      for (const block of blocks) blockCounts.set(block.key, (blockCounts.get(block.key) ?? 0) + 1);
      retained.push(candidate); pdfDiagnostics.pdfsRetained += 1; syncPages();
    } catch (error) {
      if (error instanceof PdfSkippedError) { pdfDiagnostics.pdfsSkipped += 1; if (error.truncated) pdfDiagnostics.pdfDocumentsTruncated += 1; }
      else { pdfDiagnostics.pdfsFailed += 1; warn({ stage:"pdf_parse", message:"A PDF document could not be read.", url:candidateUrl }); }
    }
  }
  if (pdfCandidates.size > PDF_LIMITS.documents) pdfDiagnostics.pdfsSkipped += pdfCandidates.size - PDF_LIMITS.documents;

  timings.totalCrawlDurationMs = Math.max(0, now() - totalStarted);
  structuredDiagnostics.structuredFactsRetained = retained.reduce((total, record) => total + record.structuredFacts, 0);
  for(const key of Object.keys(semanticDiagnostics) as (keyof SemanticDiagnostics)[]) semanticDiagnostics[key]=retained.reduce((total,record)=>total+record.semantic[key],0);

  if (pages.length === 0) {
    throw new BusinessWebsiteCrawlError("The website could not be read. Confirm the URL is public and try again.", {
      pagesDiscovered: discoveredHtmlUrls.size, pagesProcessed: pagesExtractionSucceeded, pagesFetchAttempted:pageFetchAttempts,
      pagesFetched, pagesFetchRejected, pagesExtractionAttempted, pagesExtractionSucceeded, pagesRetained:0, pagesSkipped, pagesFailed, pagesExtractionFailed,
      ...sitemapDiagnostics, ...pdfDiagnostics, ...browserDiagnostics, ...duplicateDiagnostics, ...structuredDiagnostics, ...semanticDiagnostics,
      finalUrls: [], restrictions, warningDetails, timings,
    });
  }

  return {
    requestedUrl: requestedEntry.toString(),
    resolvedUrl: homepageResolved.toString(),
    pages,
    warnings,
    crawlAttempt:{schemaVersion:1,id:crawlAttemptId,requestedUrl:websiteUrl.trim(),normalizedSubmittedUrl:requested.toString(),resolvedEntryUrl:homepageResolved.toString(),startedAt:crawlStartedAt,completedAt:new Date().toISOString(),crawlerVersion:CRAWLER_VERSION,extractionVersion:EXTRACTION_VERSION,status:warnings.length||pagesFailed||pagesExtractionFailed||restrictions.length?"partial":"completed",budgets:{htmlPages:MAX_PAGES,concurrency:MAX_CONCURRENT_FETCHES,htmlBytes:MAX_HTML_BYTES,sitemapFetches:MAX_SITEMAP_FETCHES,pdfDocuments:PDF_LIMITS.documents,pdfBytes:PDF_LIMITS.bytes,pdfPages:PDF_LIMITS.pages,browserPages:browserLimits.pages,browserTimeMs:browserLimits.totalTimeMs},restrictions},
    sourceDocuments:retained.map(record=>record.sourceDocument),
    sourceBlocks:retained.flatMap(record=>record.sourceBlocks),
    diagnostics: {
      pagesDiscovered: discoveredHtmlUrls.size,
      pagesProcessed: pagesExtractionSucceeded,
      pagesFetchAttempted:pageFetchAttempts,
      pagesFetched,
      pagesFetchRejected,
      pagesExtractionAttempted,
      pagesExtractionSucceeded,
      pagesRetained: retained.filter((record) => record.page.pageType !== "document").length,
      pagesSkipped, pagesFailed, pagesExtractionFailed,
      ...pdfDiagnostics,
      ...sitemapDiagnostics,
      ...browserDiagnostics,
      ...duplicateDiagnostics,
      ...structuredDiagnostics,
      ...semanticDiagnostics,
      finalUrls: retained.map((record) => record.finalUrl),
      restrictions,
      warningDetails,
      timings,
    },
  };
  } finally {
    if (renderer) { try { await renderer.close(); } catch { /* Rendering cleanup cannot fail a crawl. */ } }
  }
}
