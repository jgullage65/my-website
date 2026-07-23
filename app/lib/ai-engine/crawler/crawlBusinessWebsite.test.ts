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
  });

  assert.equal(result.pages.length, 12);
  assert.equal(maximumActive, 3);
  assert.ok(maximumActive <= 3);
  assert.ok(result.diagnostics.timings.homepageFetchMs >= 0);
  assert.ok(result.diagnostics.timings.pageCrawlingMs >= 0);
  assert.ok(result.diagnostics.timings.totalCrawlDurationMs >= 0);
});
