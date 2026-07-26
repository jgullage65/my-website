import assert from "node:assert/strict";
import test from "node:test";
import {
  crawlBusinessWebsite,
  resolveCrawledBusinessName,
  type CrawlRestriction,
} from "./crawlBusinessWebsite";

const page = (title: string, links = "") => `<!doctype html><html><head><title>${title}</title></head><body><main>${"Useful business content. ".repeat(8)}${links}</main></body></html>`;

test("preserves submitted root and canonical homepage identity when internal pages finish later", async () => {
  const calls: string[] = [];
  const fetchPage = async (url: URL, _restrictions: CrawlRestriction[]) => {
    calls.push(url.toString());
    if (url.hostname === "example.test") {
      return {
        resolvedUrl: new URL("https://www.example.test/"),
        html: page("Acme Plumbing | Local Experts", [
          '<a href="/contact">Contact</a>',
          '<a href="/contact/">Contact again</a>',
          '<a href="/about?campaign=one">About</a>',
          '<a href="/about-us">About us</a>',
        ].join("")),
      };
    }
    if (url.pathname === "/contact") return { resolvedUrl: url, html: page("Contact Us") };
    if (url.pathname === "/about" || url.pathname === "/about-us") {
      return { resolvedUrl: new URL("https://www.example.test/about"), html: page("About Acme") };
    }
    return null;
  };

  const result = await crawlBusinessWebsite("https://example.test/contact?from=form", undefined, {
    assertSafe: async () => undefined,
    fetchPage,
    fetchSitemap: async () => null,
  });

  assert.equal(result.requestedUrl, "https://example.test/");
  assert.equal(result.resolvedUrl, "https://www.example.test/");
  assert.equal(result.pages[0]?.pageType, "home");
  assert.equal(result.pages[0]?.title, "Acme Plumbing | Local Experts");
  assert.equal(calls.filter((url) => url === "https://www.example.test/contact").length, 1);
  assert.equal(result.pages.filter((item) => item.url === "https://www.example.test/about").length, 1);
  assert.equal(resolveCrawledBusinessName("Contact Us", result), "Acme Plumbing");
});

test("falls back from a generic homepage or internal-page name to the canonical hostname", () => {
  const crawl = {
    resolvedUrl: "https://acme-plumbing.example/",
    pages: [
      { url: "https://acme-plumbing.example/", title: "Home", pageType: "home", text: "" },
      { url: "https://acme-plumbing.example/contact", title: "Contact", pageType: "contact", text: "" },
    ],
  };
  assert.equal(resolveCrawledBusinessName("Contact", crawl), "Acme Plumbing");
  assert.equal(resolveCrawledBusinessName("Acme & Sons", crawl), "Acme & Sons");
});

test("crawls all eligible pages with bounded concurrency", async () => {
  let active = 0;
  let maximumActive = 0;
  const fetchPage = async (url: URL) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
    return { resolvedUrl: url, html: page(url.pathname === "/" ? "Acme" : url.pathname) };
  };

  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchPage,
    fetchSitemap: async () => null,
  });

  assert.equal(result.pages.length, 12);
  assert.equal(maximumActive, 3);
  assert.ok(maximumActive <= 3);
  assert.ok(result.diagnostics.timings.homepageFetchMs >= 0);
  assert.ok(result.diagnostics.timings.pageCrawlingMs >= 0);
  assert.ok(result.diagnostics.timings.totalCrawlDurationMs >= 0);
});

test("discovers same-host pages from a standard sitemap URL set", async () => {
  const calls: string[] = [];
  let sitemapFetches = 0;
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async (url) => {
      sitemapFetches += 1;
      return {
        resolvedUrl: url,
        xml: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.test/locations</loc></url>
          <url><loc>https://www.example.test/team?source=sitemap</loc></url>
          <url><loc>https://other.test/services</loc></url>
          <url><loc>https://example.test/brochure.pdf</loc></url>
        </urlset>`,
      };
    },
    fetchPage: async (url) => {
      calls.push(url.toString());
      return { resolvedUrl: url, html: page(url.pathname === "/" ? "Acme" : url.pathname) };
    },
  });

  assert.ok(!calls.includes("https://example.test/locations"));
  assert.ok(!calls.includes("https://www.example.test/team"));
  assert.ok(!calls.some((url) => url.includes("other.test") || url.includes("brochure.pdf")));
  assert.equal(sitemapFetches, 1);
  assert.equal(result.diagnostics.pagesDiscovered, 14);
});

test("follows same-host sitemap indexes and ignores malformed sitemap failures", async () => {
  const sitemapCalls: string[] = [];
  const pageCalls: string[] = [];
  await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async (url) => {
      sitemapCalls.push(url.toString());
      if (url.pathname === "/sitemap.xml") return {
        resolvedUrl: url,
        xml: `<sitemapindex><sitemap><loc>/pages.xml</loc></sitemap><sitemap><loc>/pages.xml</loc></sitemap><sitemap><loc>https://other.test/private.xml</loc></sitemap></sitemapindex>`,
      };
      return { resolvedUrl: url, xml: `<urlset><url><loc>https://example.test/case-studies</loc></url></urlset>` };
    },
    fetchPage: async (url) => {
      pageCalls.push(url.toString());
      return { resolvedUrl: url, html: page(url.pathname === "/" ? "Acme" : url.pathname) };
    },
  });
  assert.deepEqual(sitemapCalls, ["https://example.test/sitemap.xml", "https://example.test/pages.xml"]);
  assert.ok(!pageCalls.includes("https://example.test/case-studies"));

  const fallback = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => { throw new Error("malformed or unavailable"); },
    fetchPage: async (url) => ({ resolvedUrl: url, html: page("Acme") }),
  });
  assert.equal(fallback.pages.length, 12);
  assert.deepEqual(fallback.warnings, []);
});

test("keeps canonical priority paths ahead of a large sitemap within the page limit", async () => {
  let pageFetches = 0;
  const pageCalls: string[] = [];
  const locations = Array.from({ length: 1_000 }, (_, index) =>
    `<url><loc>https://example.test/page-${index}</loc></url>`,
  ).join("");
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async (url) => ({ resolvedUrl: url, xml: `<urlset>${locations}</urlset>` }),
    fetchPage: async (url) => {
      pageFetches += 1;
      pageCalls.push(url.pathname);
      return { resolvedUrl: url, html: page("Acme") };
    },
  });

  assert.equal(pageFetches, 12);
  assert.equal(result.pages.length, 12);
  assert.equal(result.diagnostics.pagesDiscovered, 1_012);
  assert.deepEqual(pageCalls, [
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
  ]);
  assert.ok(!pageCalls.some((pathname) => pathname.startsWith("/page-")));
});
