import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";

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
  canonicalUrlsDetected: number;
  canonicalDuplicatesSkipped: number;
  redirectDuplicatesSkipped: number;
  exactDuplicatesSkipped: number;
  nearDuplicatesSkipped: number;
  alternateVariantsSkipped: number;
  repeatedBoilerplateBlocksRemoved: number;
  jsonLdBlocksDetected: number;
  jsonLdBlocksParsed: number;
  malformedJsonLdBlocksIgnored: number;
  supportedStructuredEntitiesDetected: number;
  structuredFactsRetained: number;
  /** Repeated facts removed during all bounded extraction attempts, including pages later discarded. */
  structuredFactsDeduplicated: number;
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
const MAX_STRUCTURED_FACTS = 100;
const MAX_STRUCTURED_TEXT = 10_000;
const MAX_STRUCTURED_VALUE = 500;
const MAX_JSON_LD_DEPTH = 8;
const MAX_JSON_LD_ITEMS = 250;
const MAX_STRUCTURED_URLS = 10;

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
  if (segments.length > 1 && YEAR_PATH_SEGMENT.test(segments[0] ?? "")) return false;

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
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(
        /<\/(p|div|section|article|nav|header|footer|li|h1|h2|h3|h4|h5|h6)>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    protected: /(?:\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b|\b(?:hours|address)\b|mailto:|tel:|\+?\d[\d\s().-]{6,})/i.test(text),
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
  const duplicateDiagnostics = { canonicalUrlsDetected: 0, canonicalDuplicatesSkipped: 0, redirectDuplicatesSkipped: 0, exactDuplicatesSkipped: 0, nearDuplicatesSkipped: 0, alternateVariantsSkipped: 0, repeatedBoilerplateBlocksRemoved: 0 };
  const structuredDiagnostics = { jsonLdBlocksDetected: 0, jsonLdBlocksParsed: 0, malformedJsonLdBlocksIgnored: 0, supportedStructuredEntitiesDetected: 0, structuredFactsRetained: 0, structuredFactsDeduplicated: 0 };
  const emptyDiagnostics = (restrictions: CrawlRestriction[]): BusinessWebsiteCrawlDiagnostics => ({pagesDiscovered:0,pagesProcessed:0,pagesSkipped:0,pagesFailed:0,...duplicateDiagnostics,...structuredDiagnostics,finalUrls:[],restrictions,timings:{...timings,totalCrawlDurationMs:Math.max(0,now()-totalStarted)}});
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
  let pageFetchAttempts = 0;
  const homepageStarted = now();
  try {
    pageFetchAttempts += 1;
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
  const sitemapDiscovered = new Set<string>();
  const localizedUrls = new Set<string>();
  type RetainedPage = { page: CrawledBusinessPage; finalUrl: string; identity: string; priority: number; blocks: ReturnType<typeof textBlocks>; structuredFacts: number };
  const retained: RetainedPage[] = [];
  const blockCounts = new Map<string, number>();
  let preferredLanguage = (requested.searchParams.get("lang") ?? "").toLowerCase();
  const syncPages = () => { pages.splice(0, pages.length, ...retained.map((record) => record.page)); };
  const meaningfulFor = (record: Pick<RetainedPage, "blocks">) => normalizeText(record.blocks
    .filter((block) => block.protected || (blockCounts.get(block.key) ?? 0) < 3)
    .map((block) => block.text).join(" "));
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
  const protectedBlocks = new Set<string>();
  const processFetched = async (fetched: { html: string; resolvedUrl: URL }) => {
      const finalUrl = dedupeUrl(fetched.resolvedUrl.toString());
      if (finalUrls.has(finalUrl)) { pagesSkipped += 1; duplicateDiagnostics.redirectDuplicatesSkipped += 1; return; }
      finalUrls.add(finalUrl);
      const relations = extractLinkRelations(fetched.html, fetched.resolvedUrl, baseHost);
      duplicateDiagnostics.alternateVariantsSkipped += relations.ignoredAlternates;
      const safeRelation = async (value: string | undefined) => {
        if (!value) return undefined;
        try { await assertSafe(new URL(value)); return value; } catch { return undefined; }
      };
      const canonical = await safeRelation(relations.canonical);
      if (canonical) duplicateDiagnostics.canonicalUrlsDetected += 1;
      const identity = canonical ?? finalUrl;
      const extractionStarted = now();
      const text = stripHtmlToText(fetched.html);
      const structured = extractJsonLd(fetched.html);
      structuredDiagnostics.jsonLdBlocksDetected += structured.blocksDetected;
      structuredDiagnostics.jsonLdBlocksParsed += structured.blocksParsed;
      structuredDiagnostics.malformedJsonLdBlocksIgnored += structured.malformedBlocks;
      structuredDiagnostics.supportedStructuredEntitiesDetected += structured.entitiesDetected;
      structuredDiagnostics.structuredFactsDeduplicated += structured.factsDeduplicated;
      const blocks = textBlocks(text);
      const pageBlockKeys = new Set<string>();
      for (const block of blocks) {
        if (block.protected) protectedBlocks.add(block.key);
        pageBlockKeys.add(block.key);
      }
      pageBlockKeys.forEach((key) => blockCounts.set(key, (blockCounts.get(key) ?? 0) + 1));
      duplicateDiagnostics.repeatedBoilerplateBlocksRemoved = Array.from(blockCounts).reduce((total, [key, count]) =>
        total + (count >= 3 && !protectedBlocks.has(key) ? count : 0), 0);
      timings.contentExtractionMs += Math.max(0, now() - extractionStarted);
      if (text.length < 80) { pagesSkipped += 1; return; }
      const title = extractTitle(fetched.html);
      const pageType = inferPageType(fetched.resolvedUrl, title);
      const core = pageType !== "other";
      const supplementary = /\/(?:guides?|docs?|documentation|help|case-stud(?:y|ies)|resources?|academy)(?:\/|$)/i.test(fetched.resolvedUrl.pathname);
      const localized = localizedUrls.has(finalUrl);
      const actualCanonicalDestination = finalUrl === identity;
      const priority = (core ? 10_000 : supplementary ? 300 : 100) + (actualCanonicalDestination ? 1_000 : 0) + (sitemapDiscovered.has(finalUrl) && core ? 500 : 0) + Math.max(0, 200 - new URL(identity).pathname.length) - (localized ? 200 : 0);
      const retainedText = structured.text ? `${text}\n\n${structured.text}` : text;
      const candidate: RetainedPage = { page: { url: identity, title, pageType, text: retainedText }, finalUrl, identity, priority, blocks, structuredFacts: structured.factsRetained };

      const discoveryStarted = now();
      for (const discovered of discoverInternalLinks(fetched.html, fetched.resolvedUrl, baseHost).reverse()) enqueue(discovered, true, true);
      timings.pageDiscoveryMs += Math.max(0, now() - discoveryStarted);

      const htmlLanguage = (fetched.html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)/i)?.[1] ?? "").toLowerCase();
      if (!preferredLanguage && retained.length === 0) preferredLanguage = htmlLanguage || (relations.alternates.some((item) => item.language === "x-default") ? "x-default" : "");
      const preferredAlternate = relations.alternates.find((item) => preferredLanguage && (item.language === preferredLanguage || (preferredLanguage !== "x-default" && item.language.split("-")[0] === preferredLanguage.split("-")[0])))
        ?? (preferredLanguage === "x-default" ? relations.alternates.find((item) => item.language === "x-default") : undefined);
      for (const alternate of relations.alternates) {
        const safeAlternate = await safeRelation(alternate.url);
        if (!safeAlternate || alternate !== preferredAlternate || safeAlternate === identity || localizedUrls.size >= 1) { duplicateDiagnostics.alternateVariantsSkipped += 1; continue; }
        localizedUrls.add(safeAlternate);
        enqueue(safeAlternate, true, true);
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
        if (localized) duplicateDiagnostics.alternateVariantsSkipped += 1;
        else if (duplicateKind === "canonical") duplicateDiagnostics.canonicalDuplicatesSkipped += 1;
        else if (duplicateKind === "exact") duplicateDiagnostics.exactDuplicatesSkipped += 1;
        else duplicateDiagnostics.nearDuplicatesSkipped += 1;
        if (priority <= duplicate.priority) return;
        retained.splice(retained.indexOf(duplicate), 1, candidate);
        syncPages();
        onPage?.(pages.length, visited.size + queued.size + 1);
        return;
      }
      retained.push(candidate);
      syncPages();
      onPage?.(pages.length, visited.size + queued.size + 1);
  };

  for (const path of PRIORITY_PATHS.slice(1)) enqueue(new URL(path, homepageResolved.origin).toString());
  if (homepageHtml) await processFetched({ html: homepageHtml, resolvedUrl: homepageResolved });
  const sitemapStarted = now();
  const sitemapPages = await discoverSitemapPages();
  timings.pageDiscoveryMs += Math.max(0, now() - sitemapStarted);
  for (const sitemapPage of sitemapPages) enqueue(sitemapPage);

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
        pagesFailed += 1;
        const message = error instanceof Error ? error.message : error ? "Unknown crawl error" : "Page could not be read";
        if (message === "Unsafe crawler destination.") restrictions.push({type:"unsafe_destination",url:parsed.toString()});
        if (error && !warnings.includes(message)) warnings.push(message);
        continue;
      }
      await processFetched(fetched);
    }
  }

  timings.totalCrawlDurationMs = Math.max(0, now() - totalStarted);
  structuredDiagnostics.structuredFactsRetained = retained.reduce((total, record) => total + record.structuredFacts, 0);

  if (pages.length === 0) {
    throw new BusinessWebsiteCrawlError("The website could not be read. Confirm the URL is public and try again.", {
      pagesDiscovered: visited.size + queued.size + (homepageHtml ? 1 : 0), pagesProcessed: 0, pagesSkipped, pagesFailed, ...duplicateDiagnostics, ...structuredDiagnostics, finalUrls: [], restrictions, timings,
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
      ...duplicateDiagnostics,
      ...structuredDiagnostics,
      finalUrls: pages.map((page) => page.url),
      restrictions,
      timings,
    },
  };
}
