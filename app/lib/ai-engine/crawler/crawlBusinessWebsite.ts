import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";

export type CrawledBusinessPage = {
  url: string;
  title: string;
  pageType: string;
  text: string;
};

export type BusinessWebsiteCrawlResult = {
  requestedUrl: string;
  resolvedUrl: string;
  pages: CrawledBusinessPage[];
  warnings: string[];
  diagnostics: BusinessWebsiteCrawlDiagnostics;
};

export type BusinessWebsiteCrawlDiagnostics = {
  pagesDiscovered: number;
  pagesProcessed: number;
  pagesSkipped: number;
  pagesFailed: number;
  finalUrls: string[];
  restrictions: CrawlRestriction[];
  timings: BusinessWebsiteCrawlTimings;
};

export type BusinessWebsiteCrawlTimings = {
  initialUrlResolutionMs: number;
  homepageFetchMs: number;
  pageDiscoveryMs: number;
  pageCrawlingMs: number;
  contentExtractionMs: number;
  totalCrawlDurationMs: number;
};

export type CrawlRestriction = { type: "access_denied" | "rate_limited" | "redirect_blocked" | "unsupported_protocol" | "unsupported_content_type" | "unsafe_destination"; url: string; status?: number };

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
const MAX_REDIRECTS = 3;
const MAX_CONCURRENT_FETCHES = 3;

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

const MAX_PAGES = PRIORITY_PATHS.length;
const MAX_SITEMAP_FETCHES = MAX_PAGES;

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
const DATED_PATH_SEGMENT = /^(?:19|20)\d{2}$/;

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
  "pdf",
  "zip",
  "xml",
  "txt",
  "woff",
  "woff2",
  "ttf",
]);

function normalizeInputUrl(value: string): URL {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Website URL is required.");

  const parsed = new URL(
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
  );
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Website URL must use http or https.");
  }

  parsed.hash = "";
  return parsed;
}

function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
}

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

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isUnsafeIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/i.test(normalized)) return true;

  const mapped = normalized.match(
    /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/,
  );
  return mapped?.[1] ? isUnsafeIpv4(mapped[1]) : false;
}

function isUnsafeIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isUnsafeIpv4(ip);
  if (version === 6) return isUnsafeIpv6(ip);
  return true;
}

async function assertSafeDestination(url: URL): Promise<void> {
  const hostname = normalizeHost(url.hostname);
  if (!hostname || hostname === "localhost") {
    throw new Error("Unsafe crawler destination.");
  }

  if (net.isIP(hostname)) {
    if (isUnsafeIp(hostname)) {
      throw new Error("Unsafe crawler destination.");
    }
    return;
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

  const addresses = await dnsLookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((entry) => isUnsafeIp(entry.address))
  ) {
    throw new Error("Unsafe crawler destination.");
  }
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

function normalizeDiscoveryPath(url: URL): string {
  let pathname = url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { /* Keep malformed escapes encoded. */ }
  return `/${pathname.toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "")}`;
}

function isDiscoverableBusinessUrl(url: URL, discoveryText = ""): boolean {
  const path = normalizeDiscoveryPath(url);
  const segments = path.split("/").filter(Boolean);
  if (segments.some((segment) => EDITORIAL_PATH_SEGMENT.test(segment))) return false;
  if (segments.some((segment) => DATED_PATH_SEGMENT.test(segment))) return false;

  const normalizedMetadata = discoveryText.toLowerCase();
  return DISCOVERY_KEYWORDS.some((keyword) =>
    path.includes(keyword) || normalizedMetadata.includes(keyword),
  );
}

async function fetchHtml(
  url: URL,
  restrictions: CrawlRestriction[],
  initialDestinationValidated = false,
): Promise<{ html: string; resolvedUrl: URL } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = url;

    for (
      let redirectCount = 0;
      redirectCount <= MAX_REDIRECTS;
      redirectCount += 1
    ) {
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        restrictions.push({type:"unsupported_protocol",url:current.toString()});
        return null;
      }
      if (redirectCount > 0 || !initialDestinationValidated) await assertSafeDestination(current);

      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "AIBuilderWebsiteCrawler/1.0",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === MAX_REDIRECTS) { restrictions.push({type:"redirect_blocked",url:current.toString(),status:response.status}); return null; }
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) restrictions.push({type:"access_denied",url:current.toString(),status:response.status});
        if (response.status === 429) restrictions.push({type:"rate_limited",url:current.toString(),status:response.status});
        return null;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !contentType.toLowerCase().includes("text/html")
      ) {
        restrictions.push({type:"unsupported_content_type",url:current.toString(),status:response.status});
        return null;
      }

      const html = (await response.text()).slice(0, MAX_HTML_BYTES);
      return { html, resolvedUrl: current };
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSitemapXml(
  url: URL,
  _restrictions: CrawlRestriction[],
): Promise<{ xml: string; resolvedUrl: URL } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let current = url;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      if (current.protocol !== "http:" && current.protocol !== "https:") return null;
      await assertSafeDestination(current);

      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
          "user-agent": "AIBuilderWebsiteCrawler/1.0",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === MAX_REDIRECTS) return null;
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) return null;

      return {
        xml: (await response.text()).slice(0, MAX_HTML_BYTES),
        resolvedUrl: current,
      };
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function stripHtmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html: string): string {
  const title =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decodeHtml(title.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
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

    if (isDocumentOrAsset(parsed)) continue;

    if (!isDiscoverableBusinessUrl(parsed, anchorText)) continue;

    const normalized = dedupeUrl(parsed.toString());
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  return links;
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
    assertSafe?: typeof assertSafeDestination;
    now?: () => number;
  } = {},
): Promise<BusinessWebsiteCrawlResult> {
  const now = dependencies.now ?? (() => performance.now());
  const fetchPage = dependencies.fetchPage ?? fetchHtml;
  const fetchSitemap = dependencies.fetchSitemap ?? fetchSitemapXml;
  const assertSafe = dependencies.assertSafe ?? assertSafeDestination;
  const totalStarted = now();
  const timings: BusinessWebsiteCrawlTimings = { initialUrlResolutionMs: 0, homepageFetchMs: 0, pageDiscoveryMs: 0, pageCrawlingMs: 0, contentExtractionMs: 0, totalCrawlDurationMs: 0 };
  const emptyDiagnostics = (restrictions: CrawlRestriction[]): BusinessWebsiteCrawlDiagnostics => ({pagesDiscovered:0,pagesProcessed:0,pagesSkipped:0,pagesFailed:0,finalUrls:[],restrictions,timings:{...timings,totalCrawlDurationMs:Math.max(0,now()-totalStarted)}});
  let requested: URL;
  try { requested = normalizeInputUrl(websiteUrl); } catch (error) {
    const message=error instanceof Error?error.message:"Invalid website URL.";
    const restrictions:CrawlRestriction[]=message.includes("http or https")?[{type:"unsupported_protocol",url:websiteUrl.slice(0,500)}]:[];
    throw new BusinessWebsiteCrawlError(message,emptyDiagnostics(restrictions));
  }
  const restrictions: CrawlRestriction[] = [];
  const requestedRoot = new URL("/", requested.origin);
  const resolutionStarted = now();
  try { await assertSafe(requestedRoot); } catch (error) {
    timings.initialUrlResolutionMs = Math.max(0, now() - resolutionStarted);
    restrictions.push({type:"unsafe_destination",url:requested.toString()});
    throw new BusinessWebsiteCrawlError(error instanceof Error?error.message:"Unsafe crawler destination.",emptyDiagnostics(restrictions));
  }
  timings.initialUrlResolutionMs = Math.max(0, now() - resolutionStarted);

  const warnings: string[] = [];
  const pages: CrawledBusinessPage[] = [];
  let pagesSkipped = 0;
  let pagesFailed = 0;
  let homepageResolved = requestedRoot;
  let homepageHtml = "";
  const homepageStarted = now();
  try {
    const homepage = await fetchPage(requestedRoot, restrictions, true);
    if (homepage) { homepageResolved = homepage.resolvedUrl; homepageHtml = homepage.html; }
    else pagesFailed += 1;
  } catch (error) {
    pagesFailed += 1;
    const message = error instanceof Error ? error.message : "Unknown crawl error";
    if (!warnings.includes(message)) warnings.push(message);
  }
  timings.homepageFetchMs = Math.max(0, now() - homepageStarted);

  const baseHost = normalizeHost(homepageResolved.hostname);
  const queue: string[] = [];
  const queued = new Set<string>();
  const visited = new Set<string>();
  const finalUrls = new Set<string>();
  const enqueue = (value: string, front = false, alreadyClassified = false) => {
    let parsed: URL;
    try { parsed = new URL(value); } catch { return; }
    if (!alreadyClassified && !isDiscoverableBusinessUrl(parsed)) return;
    const normalized = dedupeUrl(parsed.toString());
    if (!visited.has(normalized) && !queued.has(normalized)) { queued.add(normalized); front ? queue.unshift(normalized) : queue.push(normalized); }
  };
  const normalizeSitemapPage = (value: string, sitemapUrl: URL): string | null => {
    let parsed: URL;
    try { parsed = new URL(value, sitemapUrl); } catch { return null; }
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      normalizeHost(parsed.hostname) !== baseHost ||
      isDocumentOrAsset(parsed) ||
      !isDiscoverableBusinessUrl(parsed)
    ) return null;
    return dedupeUrl(parsed.toString());
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

      try {
        const fetched = await fetchSitemap(sitemapUrl, restrictions);
        if (!fetched || normalizeHost(fetched.resolvedUrl.hostname) !== baseHost) continue;
        const parsed = extractSitemapLocations(fetched.xml);
        if (!parsed) continue;

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
        // Sitemap discovery is opportunistic; HTML discovery remains the fallback.
      }
    }
    return Array.from(discoveredPages);
  };
  const processFetched = (fetched: { html: string; resolvedUrl: URL }) => {
      const finalUrl = dedupeUrl(fetched.resolvedUrl.toString());
      if (finalUrls.has(finalUrl)) { pagesSkipped += 1; return; }
      finalUrls.add(finalUrl);
      const extractionStarted = now();
      const text = stripHtmlToText(fetched.html);
      timings.contentExtractionMs += Math.max(0, now() - extractionStarted);
      if (text.length < 80) { pagesSkipped += 1; return; }
      const title = extractTitle(fetched.html);
      pages.push({
        url: fetched.resolvedUrl.toString(),
        title,
        pageType: inferPageType(fetched.resolvedUrl, title),
        text,
      });
      const discoveryStarted = now();
      const discoveredLinks = discoverInternalLinks(
        fetched.html,
        fetched.resolvedUrl,
        baseHost,
      );
      timings.pageDiscoveryMs += Math.max(0, now() - discoveryStarted);
      for (const discovered of discoveredLinks) enqueue(discovered, false, true);
      onPage?.(pages.length, visited.size + queued.size + 1);
  };

  for (const path of PRIORITY_PATHS.slice(1)) enqueue(new URL(path, homepageResolved.origin).toString());
  if (homepageHtml) processFetched({ html: homepageHtml, resolvedUrl: homepageResolved });
  const sitemapStarted = now();
  const sitemapPages = await discoverSitemapPages();
  timings.pageDiscoveryMs += Math.max(0, now() - sitemapStarted);
  for (const sitemapPage of sitemapPages) enqueue(sitemapPage);

  while (queue.length > 0 && visited.size < MAX_PAGES - 1) {
    const batch: URL[] = [];
    while (
      queue.length &&
      batch.length < MAX_CONCURRENT_FETCHES &&
      visited.size < MAX_PAGES - 1
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
    const crawlStarted = now();
    const fetchedBatch = await Promise.all(batch.map(async (parsed) => {
      try { return { parsed, fetched: await fetchPage(parsed, restrictions), error: null }; }
      catch (error) { return { parsed, fetched: null, error }; }
    }));
    timings.pageCrawlingMs += Math.max(0, now() - crawlStarted);
    for (const { parsed, fetched, error } of fetchedBatch) {
      if (!fetched) {
        pagesFailed += 1;
        const message = error instanceof Error ? error.message : error ? "Unknown crawl error" : "Page could not be read";
        if (message === "Unsafe crawler destination.") restrictions.push({type:"unsafe_destination",url:parsed.toString()});
        if (error && !warnings.includes(message)) warnings.push(message);
        continue;
      }
      processFetched(fetched);
    }
  }

  timings.totalCrawlDurationMs = Math.max(0, now() - totalStarted);

  if (pages.length === 0) {
    throw new BusinessWebsiteCrawlError("The website could not be read. Confirm the URL is public and try again.", {
      pagesDiscovered: visited.size + queued.size + (homepageHtml ? 1 : 0), pagesProcessed: 0, pagesSkipped, pagesFailed, finalUrls: [], restrictions, timings,
    });
  }

  return {
    requestedUrl: requestedRoot.toString(),
    resolvedUrl: homepageResolved.toString(),
    pages,
    warnings,
    diagnostics: {
      pagesDiscovered: visited.size + queued.size + 1,
      pagesProcessed: pages.length,
      pagesSkipped,
      pagesFailed,
      finalUrls: pages.map((page) => page.url),
      restrictions,
      timings,
    },
  };
}
