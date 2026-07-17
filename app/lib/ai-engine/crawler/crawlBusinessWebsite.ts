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
};

const MAX_PAGES = 8;
const MAX_HTML_BYTES = 750_000;
const MAX_TEXT_PER_PAGE = 12_000;
const FETCH_TIMEOUT_MS = 7_000;
const MAX_REDIRECTS = 3;

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
  "process",
  "guarantee",
  "team",
  "solution",
  "industry",
  "customer",
] as const;

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

async function fetchHtml(
  url: URL,
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
      await assertSafeDestination(current);

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
        if (!location || redirectCount === MAX_REDIRECTS) return null;
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType &&
        !contentType.toLowerCase().includes("text/html")
      ) {
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
    .trim()
    .slice(0, MAX_TEXT_PER_PAGE);
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

    const pathAndText = `${parsed.pathname.toLowerCase()} ${anchorText}`;
    if (
      !DISCOVERY_KEYWORDS.some((keyword) =>
        pathAndText.includes(keyword),
      )
    ) {
      continue;
    }

    const normalized = dedupeUrl(parsed.toString());
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  }

  return links;
}

export async function crawlBusinessWebsite(
  websiteUrl: string,
  onPage?: (completedPages: number, maximumPages: number) => void,
): Promise<BusinessWebsiteCrawlResult> {
  const requested = normalizeInputUrl(websiteUrl);
  await assertSafeDestination(requested);

  const baseHost = normalizeHost(requested.hostname);
  const warnings: string[] = [];
  const queue = PRIORITY_PATHS.map((path) =>
    dedupeUrl(new URL(path, requested.origin).toString()),
  );
  const queued = new Set(queue);
  const visited = new Set<string>();
  const pages: CrawledBusinessPage[] = [];
  let resolvedUrl = requested.toString();

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const nextUrl = queue.shift();
    if (!nextUrl || visited.has(nextUrl)) continue;
    visited.add(nextUrl);

    let parsed: URL;
    try {
      parsed = new URL(nextUrl);
    } catch {
      continue;
    }

    if (
      normalizeHost(parsed.hostname) !== baseHost ||
      isDocumentOrAsset(parsed)
    ) {
      continue;
    }

    try {
      const fetched = await fetchHtml(parsed);
      if (!fetched) continue;

      resolvedUrl = fetched.resolvedUrl.toString();
      const text = stripHtmlToText(fetched.html);
      if (text.length < 80) continue;

      const title = extractTitle(fetched.html);
      pages.push({
        url: fetched.resolvedUrl.toString(),
        title,
        pageType: inferPageType(fetched.resolvedUrl, title),
        text,
      });
      onPage?.(pages.length, MAX_PAGES);

      const discoveredLinks = discoverInternalLinks(
        fetched.html,
        fetched.resolvedUrl,
        baseHost,
      );

      for (const discovered of discoveredLinks) {
        if (!visited.has(discovered) && !queued.has(discovered)) {
          queued.add(discovered);
          queue.unshift(discovered);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown crawl error";
      if (!warnings.includes(message)) warnings.push(message);
    }
  }

  if (pages.length === 0) {
    throw new Error(
      "The website could not be read. Confirm the URL is public and try again.",
    );
  }

  return {
    requestedUrl: requested.toString(),
    resolvedUrl,
    pages,
    warnings,
  };
}
