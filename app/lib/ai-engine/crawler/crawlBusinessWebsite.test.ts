import assert from "node:assert/strict";
import test from "node:test";
import {
  BusinessWebsiteCrawlError,
  assertSafeDestination,
  createPlaywrightRenderer,
  crawlBusinessWebsite,
  fetchHtml,
  fetchSitemapXml,
  resolveCrawledBusinessName,
  type CrawlRestriction,
} from "./crawlBusinessWebsite";

const page = (title: string, links = "") => `<!doctype html><html><head><title>${title}</title></head><body><main>${"Useful business content. ".repeat(8)}${links}</main></body></html>`;

const oversizedResponse = (cancelled: { value: boolean }) => ({
  status: 200,
  ok: true,
  headers: new Headers({ "content-type": "text/html" }),
  body: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(500_000));
      controller.enqueue(new Uint8Array(500_000));
    },
    cancel() { cancelled.value = true; },
  }),
});

test("streams and cancels oversized HTML and sitemap responses without content-length", async () => {
  for (const kind of ["html", "sitemap"] as const) {
    const restrictions: CrawlRestriction[] = [];
    const cancelled = { value: false };
    const request = async () => oversizedResponse(cancelled);
    await assert.rejects(
      kind === "html"
        ? fetchHtml(new URL("https://example.test/"), restrictions, false, request)
        : fetchSitemapXml(new URL("https://example.test/sitemap.xml"), restrictions, request),
      /exceeds the download limit/,
    );
    assert.equal(cancelled.value, true, kind);
    assert.equal(restrictions[0]?.type, "response_too_large", kind);
  }
});

test("revalidates every redirect before reading the next destination", async () => {
  const requested: string[] = [];
  const restrictions: CrawlRestriction[] = [];
  const emptyBody = () => new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  await assert.rejects(fetchHtml(new URL("https://example.test/"), restrictions, false, async (url) => {
    requested.push(url.toString());
    if (url.pathname === "/private") throw new Error("Unsafe crawler destination.");
    return { status: 302, ok: false, headers: new Headers({ location: "/private" }), body: emptyBody() };
  }), /Unsafe crawler destination/);
  assert.deepEqual(requested, ["https://example.test/", "https://example.test/private"]);
  assert.deepEqual(restrictions, [{ type: "unsafe_destination", url: "https://example.test/private" }]);
});

test("retains bounded semantic sections while ignoring statically hidden content", async () => {
  const html = `<!doctype html><title>Home</title><meta property="og:title" content="Acme Services">
    <main><h1>Réparations commerciales</h1><p>Installation and repair for offices and retail locations.</p>
    <ul><li>Emergency repair</li><li>Emergency repair</li><li>Water-heater installation<ul><li>Same-day assessment</li></ul></li></ul>
    <table><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Starter</td><td>$99/month</td></tr></tbody></table>
    <dl><dt>Service area</dt><dd>Dallas</dd><dd>Fort Worth</dd></dl>
    <details><summary>Do you offer emergency service?</summary><p>Yes, emergency service is available 24 hours.</p></details>
    <p hidden>Hidden offer</p><p aria-hidden="true">Technical label</p><p inert>Inert payload</p><p style="display:none">Invisible payload</p>
    <p style="visibility:hidden">Visually hidden payload</p><script>Analytics payload</script><style>Technical CSS</style><svg>Vector internals</svg><template>Hydration template</template>
    <div class="cookie-consent-banner"><button>Accept tracking cookies</button></div></main>`;
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl:url, html } : null,
  });
  const retained=result.pages[0]!;
  assert.equal(retained.title,"Réparations commerciales");
  assert.match(retained.text,/Réparations commerciales\nInstallation and repair/);
  assert.equal((retained.text.match(/- Emergency repair/g)??[]).length,1);
  assert.match(retained.text,/Plan \| Price\nStarter \| \$99\/month/);
  assert.match(retained.text,/Service area: Dallas\nService area: Fort Worth/);
  assert.match(retained.text,/Question: Do you offer emergency service\?\nAnswer: Yes, emergency service is available 24 hours\./);
  assert.doesNotMatch(retained.text,/Hidden offer|Technical label|Inert payload|Invisible payload|Visually hidden payload|Analytics payload|Technical CSS|Vector internals|Hydration template|Accept tracking cookies/);
  assert.equal(result.diagnostics.tablesRetained,1);
  assert.equal(result.diagnostics.visibleFaqsRetained,1);
  assert.equal(result.diagnostics.hiddenElementsIgnored,5);
});

const crawlSingleSemanticPage = (html: string) => crawlBusinessWebsite("https://example.test", undefined, {
  assertSafe: async () => undefined,
  fetchSitemap: async () => null,
  fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl: url, html: `${html}<p>${"Durable business evidence. ".repeat(5)}</p>` } : null,
});

test("preserves nested lists and ordered start/value without charging rejected navigation", async () => {
  const navigation=Array.from({length:35},(_,index)=>`<li><a href="/menu-${index}">Menu ${index}</a></li>`).join("");
  const result=await crawlSingleSemanticPage(`<title>Services</title><nav><ul>${navigation}</ul></nav><main>
    <ol start="4"><li>Assessment</li><li value="9">Installation<ul><li>Same-day scheduling</li></ul></li></ol>
    <ul><li>Emergency repair</li><li>Preventive maintenance</li></ul></main>`);
  assert.match(result.pages[0]!.text,/4\. Assessment\n9\. Installation\n  - Same-day scheduling/);
  assert.match(result.pages[0]!.text,/- Emergency repair\n- Preventive maintenance/);
  assert.doesNotMatch(result.pages[0]!.text,/Menu 0/);
  assert.equal(result.diagnostics.listItemsRetained,5);
});

test("expands simple table spans and rejects layout tables without consuming table budget", async () => {
  const layouts=Array.from({length:12},()=>`<table role="presentation"><tr><td>Left</td><td>Right</td></tr><tr><td>Top</td><td>Bottom</td></tr></table>`).join("");
  const result=await crawlSingleSemanticPage(`<title>Pricing</title>${layouts}<table><tr><th rowspan="2">Plan</th><th colspan="2">Price</th></tr>
    <tr><th>Monthly</th><th>Annual</th></tr><tr><td>Starter</td><td>$99</td><td>$999</td></tr></table>`);
  assert.match(result.pages[0]!.text,/Plan \| Price \| Price\nPlan \| Monthly \| Annual\nStarter \| \$99 \| \$999/);
  assert.doesNotMatch(result.pages[0]!.text,/Left \| Right/);
  assert.equal(result.diagnostics.tablesRetained,1);
  assert.equal(result.diagnostics.extractionOutputTruncated,0);
});

test("extracts common visible FAQ wrappers once and ignores incomplete pairs", async () => {
  const result=await crawlSingleSemanticPage(`<title>FAQ</title><main>
    <section><h2>Do you provide emergency support?</h2><p>Yes, every day.</p></section>
    <div class="faq-card"><div class="question">Where are you located?</div><div class="answer"><div class="answer">Dallas and Fort Worth.</div></div></div>
    <dl class="faq"><dt>Can I book online?</dt><dd>Yes, use our booking form.</dd></dl>
    <div class="question">Unanswered question?</div><div class="answer"></div></main>`);
  const text=result.pages[0]!.text;
  assert.match(text,/Question: Do you provide emergency support\?\nAnswer: Yes, every day\./);
  assert.equal((text.match(/Question: Where are you located\?/g)??[]).length,1);
  assert.match(text,/Question: Can I book online\?\nAnswer: Yes, use our booking form\./);
  assert.doesNotMatch(text,/Question: Unanswered question/);
  assert.equal(result.diagnostics.visibleFaqsRetained,3);
});

test("marks semantic cap truncation and retains repeated footer contact and navigation hours", async () => {
  const paragraphs=Array.from({length:310},(_,index)=>`<p>Policy condition ${index} applies to customer service requests.</p>`).join("");
  const first=await crawlSingleSemanticPage(`<title>Policies</title>${paragraphs}`);
  assert.equal(first.diagnostics.extractionOutputTruncated,1);
  assert.equal(first.diagnostics.paragraphsRetained,300);

  const contact=`<nav>Hours: Monday-Friday 08:00-17:00</nav><footer>Emergency contact: help@example.test, +1 (555) 123-4567, 100 Main Street</footer>`;
  const result=await crawlBusinessWebsite("https://example.test",undefined,{assertSafe:async()=>undefined,fetchSitemap:async()=>null,fetchPage:async(url)=>({resolvedUrl:url,html:`<title>${url.pathname}</title><main>${Array.from({length:30},(_,index)=>`${url.pathname}-fact-${index}`).join(" ")}</main>${contact}`})});
  assert.ok(result.pages.length>2);
  assert.ok(result.pages.every(pageResult=>pageResult.text.includes("+1 (555) 123-4567")&&pageResult.text.includes("Monday-Friday")));
});

test("uses deterministic meaningful title and metadata fallbacks", async () => {
  const cases:[string,string,string][]=[
    ["meaningful title","<title>Acme &amp; Sons</title><h1>Ignored heading</h1>","Acme & Sons"],
    ["h1","<title>Welcome</title><h1>Visible Services</h1><meta property=\"og:title\" content=\"Social title\">","Visible Services"],
    ["Open Graph","<title>Untitled</title><meta property=\"og:title\" content=\"OG Services\">","OG Services"],
    ["Twitter","<title>New Page</title><meta name=\"twitter:title\" content=\"Twitter Services\">","Twitter Services"],
    ["URL path","<title>Home</title>","Emergency Plumbing"],
  ];
  for(const [label,head,expected] of cases){
    const path=label==="URL path"?"/emergency-plumbing":"/";
    const result=await crawlBusinessWebsite(`https://example.test${path}`,undefined,{assertSafe:async()=>undefined,fetchSitemap:async()=>null,fetchPage:async(url)=>url.pathname===path||path!=="/"&&url.pathname==="/"?{resolvedUrl:new URL(`https://example.test${path}`),html:`${head}<main>${"Meaningful durable business information. ".repeat(5)}</main>`}:null});
    assert.equal(result.pages[0]!.title,expected,label);
  }
});

test("bounds oversized and malformed semantic structures deterministically", async () => {
  const list=Array.from({length:45},(_,index)=>`<li>Service option ${index}</li>`).join("");
  const definitions=Array.from({length:90},(_,index)=>`<dt>Specification ${index}</dt>${index===2?"<dd></dd>":`<dd>Value ${index}</dd>`}`).join("");
  const rows=Array.from({length:40},(_,index)=>`<tr><td>Plan ${index}<td>$${index}</tr>`).join("");
  const deep=`${"<div>".repeat(70)}Deep bounded content${"</div>".repeat(70)}`;
  const html=`<title>Services and specifications</title><ul>${list}</ul><dl>${definitions}</dl><table><tr><th>Plan</th><th>Price</th></tr>${rows}</table>${deep}`;
  const first=await crawlSingleSemanticPage(html),second=await crawlSingleSemanticPage(html);
  assert.equal(first.pages[0]!.text,second.pages[0]!.text);
  assert.equal(first.diagnostics.listItemsRetained,30);
  assert.equal(first.diagnostics.definitionEntriesRetained,80);
  assert.equal(first.diagnostics.tableRowsRetained,30);
  assert.equal(first.diagnostics.extractionOutputTruncated,1);
  assert.doesNotMatch(first.pages[0]!.text,/Service option 44|Specification 89|Plan 39/);
});

test("keeps invalid numeric entities and malformed URL escapes page-local and readable", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/"
      ? { resolvedUrl: new URL("https://example.test/bad%ZZ"), html: `<title>Home</title><main><p>${"Durable service information. ".repeat(5)}&#999999999; &#xD800;</p></main>` }
      : null,
  });
  assert.equal(result.pages.length, 1);
  assert.match(result.pages[0]!.text, /�/);
  assert.equal(result.diagnostics.pagesExtractionFailed, 0);
});

test("isolates an unexpected extraction failure and retains later safe pages", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      if (url.pathname === "/") return { resolvedUrl: url, html: {} as unknown as string };
      if (url.pathname === "/about") return { resolvedUrl: url, html: page("About") };
      return null;
    },
  });
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0]!.pageType, "about");
  assert.equal(result.diagnostics.pagesExtractionFailed, 1);
  assert.match(result.warnings.join(" "), /fetched but its content could not be extracted/);
});

test("does not turn progress observer failures into extraction failures", async () => {
  const result = await crawlBusinessWebsite("https://example.test", () => { throw new Error("observer failed"); }, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl: url, html: page("Home") } : null,
  });
  assert.equal(result.pages.length, 1);
  assert.equal(result.diagnostics.pagesExtractionFailed, 0);
  assert.doesNotMatch(result.warnings.join(" "), /observer failed/);
});

test("rejects DNS answers when any destination is unsafe and rejects non-public IPv6", async () => {
  await assert.rejects(
    assertSafeDestination(new URL("https://example.test"), async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    /Unsafe crawler destination/,
  );
  await assert.rejects(assertSafeDestination(new URL("https://[ff02::1]/")), /Unsafe crawler destination/);
  assert.deepEqual(
    await assertSafeDestination(new URL("https://example.test"), async () => [
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
      { address: "93.184.216.34", family: 4 },
    ]),
    {
      address: "93.184.216.34",
      family: 4,
      addresses: [
        { address: "93.184.216.34", family: 4 },
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
      ],
    },
  );
  for (const unsafe of ["192.0.2.10", "198.18.0.1", "198.51.100.20", "203.0.113.30", "2001:db8::1", "3fff::1"]) {
    await assert.rejects(assertSafeDestination(new URL(`https://${unsafe.includes(":") ? `[${unsafe}]` : unsafe}/`)), /Unsafe crawler destination/, unsafe);
  }
  await assert.rejects(
    assertSafeDestination(new URL("https://example.test"), async () => [{ address: "93.184.216.34", family: 6 }]),
    /Unsafe crawler destination/,
  );
  await assert.rejects(
    assertSafeDestination(new URL("https://example.test"), async () => await new Promise(() => {}), 5),
    /DNS resolution timed out/,
  );
  let resolvedHost = "";
  await assertSafeDestination(new URL("https://www.example.test"), async (hostname) => {
    resolvedHost = hostname;
    return [{ address: "93.184.216.34", family: 4 }];
  });
  assert.equal(resolvedHost, "www.example.test");
  await assert.rejects(crawlBusinessWebsite("https://user:secret@example.test"), /must not contain credentials/);
});

test("normalizes equivalent paragraph and list meaning for duplicate comparison", async () => {
  const meaning="Emergency plumbing installation repair maintenance scheduling warranty licensed technicians available throughout Dallas and Fort Worth";
  const result=await crawlBusinessWebsite("https://example.test",undefined,{assertSafe:async()=>undefined,fetchSitemap:async()=>null,fetchPage:async(url)=>{
    if(url.pathname==="/")return{resolvedUrl:url,html:`<main><p>${meaning}</p></main>`};
    if(url.pathname==="/about")return{resolvedUrl:url,html:`<main><ul><li>${meaning}</li></ul></main>`};
    return null;
  }});
  assert.equal(result.pages.length,1);
  assert.ok(result.diagnostics.exactDuplicatesSkipped>=1);
});

test("appends readable JSON-LD business evidence and records parsing diagnostics", async () => {
  const structured = [
    { "@type": ["Organization", "UnexpectedType"], name: "Acme Plomberie", description: "Réparations durables", telephone: "555-123-4567", address: { "@type": "PostalAddress", streetAddress: "100 Main Street", addressLocality: "Dallas", addressRegion: "TX", postalCode: "75201" } },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Friday"], opens: "08:00", closes: "17:00" },
    { "@type": "Service", name: "Emergency repair", offers: { "@type": "Offer", price: 149, priceCurrency: "USD", availability: "InStock" } },
    { "@type": "FAQPage", mainEntity: { "@type": "Question", name: "Emergency service?", acceptedAnswer: { "@type": "Answer", text: "Available 24 hours." } } },
    { "@type": "Person", name: "Ada Expert", jobTitle: "Master Plumber" },
    { "@type": "Review", reviewBody: "Excellent work", author: { "@type": "Person", name: "Sam" }, reviewRating: { "@type": "AggregateRating", ratingValue: 4.9, reviewCount: 42 } },
  ];
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl: url, html: `<main>${"Visible homepage details remain first. ".repeat(8)}</main><script type="application/ld+json">${JSON.stringify({ "@graph": structured })}</script><script type='application/ld+json'>{bad</script><script>throw new Error("never execute")</script>` } : null,
  });
  const text = result.pages[0]?.text ?? "";
  assert.ok(text.startsWith("Visible homepage details"));
  assert.match(text, /Structured business data:\nBusiness name: Acme Plomberie/);
  assert.match(text, /Address: 100 Main Street, Dallas, TX, 75201/);
  assert.match(text, /Opening hours: Monday, Friday 08:00-17:00/);
  assert.match(text, /Service name: Emergency repair/);
  assert.match(text, /Price: 149/);
  assert.match(text, /FAQ question: Emergency service\?/);
  assert.match(text, /FAQ answer: Available 24 hours\./);
  assert.match(text, /Person name: Ada Expert/);
  assert.match(text, /Aggregate rating: 4\.9/);
  assert.ok(!text.includes('"@type"'));
  assert.equal(result.diagnostics.jsonLdBlocksDetected, 2);
  assert.equal(result.diagnostics.jsonLdBlocksParsed, 1);
  assert.equal(result.diagnostics.malformedJsonLdBlocksIgnored, 1);
  assert.ok(result.diagnostics.supportedStructuredEntitiesDetected >= structured.length);
  assert.equal(result.warnings.length, 0);
});

test("supports multiple blocks and top-level arrays while deduplicating facts", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl: url, html: `<main>${"Visible distinct content. ".repeat(8)}</main><script type=application/ld+json>${JSON.stringify([{ "@type": "Product", name: "Pro Pump", sku: "PP-1" }])}</script><script TYPE="APPLICATION/LD+JSON">${JSON.stringify({ "@type": "Product", name: "Pro Pump", sku: "PP-1" })}</script>` } : null,
  });
  assert.equal(result.diagnostics.jsonLdBlocksParsed, 2);
  assert.ok(result.diagnostics.structuredFactsDeduplicated >= 2);
  assert.equal(result.pages[0]?.text.match(/Product name: Pro Pump/g)?.length, 1);
});

test("site-wide JSON-LD neither expands discovery nor collapses visibly distinct pages", async () => {
  const calls: string[] = [];
  const json = JSON.stringify({ "@type": "Organization", name: "Shared Company", url: "javascript:alert(1)", sameAs: "https://external.test/profile" });
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url) => { calls.push(url.toString()); const route = url.pathname.replace(/\W/g, "") || "home"; return { resolvedUrl: url, html: `<main>${`${route} specialized ${route} customer details and policies. `.repeat(10)}</main><script type="application/ld+json">${json}</script>` }; },
  });
  assert.ok(result.pages.length > 3);
  assert.ok(result.pages.every((item) => item.text.includes("Structured business data:")));
  assert.ok(!calls.some((url) => url.includes("external.test") || url.includes("javascript")));
  assert.ok(result.pages.every((item) => !item.text.includes("javascript:alert")));
});

test("recognizes LocalBusiness subtypes, URL arrays, and referenced answers", async () => {
  const graph = [
    { "@type": "Restaurant", name: "North Café", telephone: "555-0100", sameAs: ["https://social.test/a", "javascript:bad()", "https://social.test/a", { "@id": "https://social.test/b" }] },
    { "@type": ["Plumber", "UnknownSpecialty"], name: "Pipe Pro", areaServed: "Dallas" },
    { "@type": "MedicalClinic", name: "Healthy Clinic", address: { "@type": "PostalAddress", streetAddress: "1 Care Way" } },
    { "@id": "#answer", "@type": "Answer", text: "Yes, every day." },
    { "@type": "Question", name: "Open daily?", acceptedAnswer: [{ "@id": "#answer" }, { "@type": "Answer", text: "Including weekends." }] },
  ];
  const calls: string[] = [];
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url) => { calls.push(url.toString()); return url.pathname === "/" ? { resolvedUrl: url, html: `<main>${"Visible healthcare and trade information. ".repeat(8)}</main><script type="application/ld+json">${JSON.stringify({ "@graph": graph })}</script>` } : null; },
  });
  const text = result.pages[0]?.text ?? "";
  assert.match(text, /Business name: North Café/);
  assert.match(text, /Business name: Pipe Pro/);
  assert.match(text, /Business name: Healthy Clinic/);
  assert.equal(text.match(/External profile: https:\/\/social\.test\/a/g)?.length, 1);
  assert.match(text, /External profile: https:\/\/social\.test\/b/);
  assert.ok(!text.includes("javascript:bad"));
  assert.match(text, /FAQ answer: Yes, every day\./);
  assert.match(text, /FAQ answer: Including weekends\./);
  assert.ok(!calls.some((url) => url.includes("social.test")));
});

test("keeps structured extraction bounded for deep and very large JSON-LD", async () => {
  let deep: Record<string, unknown> = { "@type": "Organization", name: "Too Deep" };
  for (let index = 0; index < 30; index += 1) deep = { child: deep };
  const many = Array.from({ length: 1_000 }, (_, index) => ({ "@type": "Product", name: `Product ${index}`, description: "x".repeat(2_000) }));
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl: url, html: `<main>${"Visible bounded extraction content. ".repeat(8)}</main><script type="application/ld+json">${JSON.stringify([deep, ...many])}</script><script type="application/ld+json">{broken</script>` } : null,
  });
  const structured = (result.pages[0]?.text ?? "").split("Structured business data:\n")[1] ?? "";
  assert.ok(structured.length <= 10_000);
  assert.ok(structured.split("\n").filter(Boolean).length <= 100);
  assert.ok(!structured.includes("x".repeat(501)));
  assert.ok(!structured.includes("Too Deep"));
  assert.ok(result.diagnostics.supportedStructuredEntitiesDetected <= 250);
  assert.equal(result.diagnostics.malformedJsonLdBlocksIgnored, 1);
});

test("empty JSON-LD emits no structured section", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? { resolvedUrl: url, html: `<main>${"Visible content remains available. ".repeat(8)}</main><script type="application/ld+json">{}</script><script type="application/ld+json">[]</script>` } : null,
  });
  assert.ok(!result.pages[0]?.text.includes("Structured business data:"));
  assert.equal(result.diagnostics.structuredFactsRetained, 0);
});

test("retained fact diagnostics exclude duplicates and follow canonical replacement", async () => {
  const visible = "Identical visible installation repair and maintenance information. ".repeat(10);
  const json = (name: string, description?: string) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name, description })}</script>`;
  const crawl = () => crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap: async () => null,
    fetchPage: async (url: URL) => {
      if (url.pathname === "/") return { resolvedUrl: url, html: `<main>${visible}</main>${json("Home retained")}` };
      if (url.pathname === "/about") return { resolvedUrl: url, html: `<head><link rel="canonical" href="/services"></head><main>${"Canonical family visible facts. ".repeat(10)}</main>${json("Weak alias", "Must be removed")}` };
      if (url.pathname === "/services") return { resolvedUrl: url, html: `<main>${"Canonical family visible facts. ".repeat(10)}</main>${json("Strong canonical")}` };
      if (url.pathname === "/about-us") return { resolvedUrl: url, html: `<main>${visible}</main>${json("Discarded duplicate", "Not retained")}` };
      return null;
    },
  });
  const first = await crawl();
  const second = await crawl();
  const evidenceLines = first.pages.flatMap((page) => page.text.split("\n")).filter((line) => /^[A-Z][^:]*: .+/.test(line) && line !== "Structured business data:");
  assert.equal(first.diagnostics.structuredFactsRetained, evidenceLines.length);
  assert.equal(first.diagnostics.structuredFactsRetained, 2);
  assert.ok(first.pages.some((page) => page.text.includes("Business name: Strong canonical")));
  assert.ok(first.pages.every((page) => !page.text.includes("Weak alias") && !page.text.includes("Discarded duplicate")));
  assert.equal(first.diagnostics.structuredFactsRetained, second.diagnostics.structuredFactsRetained);
  assert.ok(first.diagnostics.supportedStructuredEntitiesDetected > first.diagnostics.structuredFactsRetained);
});

test("uses safe same-domain canonicals and ignores external canonicals", async () => {
  const canonicalPage = (canonical: string) => `<!doctype html><html><head><title>Services</title><link rel="canonical" href="${canonical}"></head><body><main>${"Distinct plumbing installation and repair details. ".repeat(8)}</main></body></html>`;
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      if (url.pathname === "/") return { resolvedUrl: url, html: page("Acme", '<a href="/services-alias">Services</a>') };
      if (url.pathname === "/services") return { resolvedUrl: url, html: canonicalPage("/services?utm_source=search") };
      if (url.pathname === "/about-us") return { resolvedUrl: url, html: canonicalPage("https://example.test/services") };
      if (url.pathname === "/about") return { resolvedUrl: url, html: `<!doctype html><head><link rel="canonical" href="https://external.test/about"></head><main>${"Company history leadership values and operating experience. ".repeat(8)}</main>` };
      return null;
    },
  });
  assert.equal(result.pages.filter((item) => item.url === "https://example.test/services").length, 1);
  assert.ok(result.pages.some((item) => item.url === "https://example.test/about"));
  assert.equal(result.diagnostics.canonicalUrlsDetected, 2);
});

test("deduplicates redirect, exact, and near-identical pages without exceeding the fetch cap", async () => {
  const calls: string[] = [];
  const body = "Commercial plumbing installation repair maintenance emergency scheduling warranty licensed technicians ".repeat(12);
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      calls.push(url.pathname);
      if (url.pathname === "/") return { resolvedUrl: url, html: `<main>${body}</main>` };
      if (url.pathname === "/about") return { resolvedUrl: new URL("https://example.test/company"), html: `<main>${body} About our team.</main>` };
      if (url.pathname === "/about-us") return { resolvedUrl: new URL("https://example.test/company"), html: `<main>${body} About our team.</main>` };
      if (url.pathname === "/services") return { resolvedUrl: url, html: `<main>Limited offer today! ${body}</main>` };
      return { resolvedUrl: url, html: `<main>${url.pathname} ${"materially distinct business policy and customer information ".repeat(10)}</main>` };
    },
  });
  assert.equal(calls.length, PRIORITY_FETCH_PATHS.length);
  assert.ok(result.diagnostics.redirectDuplicatesSkipped >= 1);
  assert.ok(result.diagnostics.nearDuplicatesSkipped >= 1);
});

test("restrains hreflang alternates and never fetches an external alternate", async () => {
  const calls: string[] = [];
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      calls.push(url.toString());
      const alternates = url.pathname === "/" ? '<link rel="alternate" hreflang="fr" href="/fr/services"><link rel="alternate" hreflang="x-default" href="/services"><link rel="alternate" hreflang="en" href="https://external.test/services">' : "";
      return { resolvedUrl: url, html: `<html lang="de"><head>${alternates}</head><body><main>${url.pathname} ${"durable business details ".repeat(12)}</main></body></html>` };
    },
  });
  assert.ok(!calls.some((url) => url.includes("external.test")));
  assert.ok(result.diagnostics.alternateVariantsSkipped >= 2);
  assert.ok(calls.length <= PRIORITY_FETCH_PATHS.length);
});

test("replaces a weaker canonical alias without disturbing unrelated retained pages", async () => {
  const content = "Installation repair maintenance guarantees scheduling and licensed service details. ".repeat(10);
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      if (url.pathname === "/") return { resolvedUrl: url, html: page("Acme") };
      if (url.pathname === "/about") return { resolvedUrl: url, html: `<head><title>Weak alias</title><link rel="canonical" href="/services"></head><main>${content}</main>` };
      if (url.pathname === "/about-us") return { resolvedUrl: url, html: `<title>Independent company page</title><main>${"Unique company history leadership and values. ".repeat(10)}</main>` };
      if (url.pathname === "/services") return { resolvedUrl: url, html: `<title>Canonical services</title><main>${content}</main>` };
      return null;
    },
  });
  assert.equal(result.pages.find((item) => item.url === "https://example.test/services")?.title, "Canonical services");
  assert.ok(result.pages.some((item) => item.title === "Independent company page"));
  assert.equal(result.diagnostics.canonicalDuplicatesSkipped, 1);
});

test("dynamically discounts repeated blocks while preserving repeated contact details", async () => {
  const shared = "Shared navigation Products Services Pricing Newsletter signup";
  const contact = "Call 555-123-4567. Hours Monday to Friday 9 to 5.";
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => ({ resolvedUrl: url, html: `<header>${shared}</header><main>${`${url.pathname.replace(/\W/g, "") || "homepage"} specialized details `.repeat(20)}</main><footer>${contact}</footer>` }),
  });
  assert.ok(result.diagnostics.repeatedBoilerplateBlocksRemoved >= 3);
  assert.ok(result.pages.every((item) => item.text.includes(contact)));
  assert.ok(result.pages.length > 3);
});

test("does not count repeated occurrences within one page as site-wide boilerplate", async () => {
  const repeated = "Repeated promotional navigation block";
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/" ? {
      resolvedUrl: url,
      html: `<header>${repeated}</header><nav>${repeated}</nav><footer>${repeated}</footer><main>${"Unique homepage business information. ".repeat(10)}</main>`,
    } : null,
  });
  assert.equal(result.diagnostics.repeatedBoilerplateBlocksRemoved, 0);
});

test("uses the homepage language consistently when scheduling alternates", async () => {
  const calls: string[] = [];
  await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      calls.push(url.pathname);
      const links = url.pathname === "/" ? '<link rel="alternate" hreflang="fr" href="/fr/services"><link rel="alternate" hreflang="en-US" href="/en/services"><link rel="alternate" hreflang="x-default" href="/default/services">' : "";
      return { resolvedUrl: url, html: `<html lang="en"><head>${links}</head><main>${url.pathname} ${"Business content specific to this route. ".repeat(10)}</main></html>` };
    },
  });
  assert.ok(calls.includes("/en/services"));
  assert.ok(!calls.includes("/fr/services"));
  assert.ok(!calls.includes("/default/services"));
});

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
  assert.equal(result.diagnostics.pagesDiscovered, 13);
});

test("discovers durable supplementary pages from HTML and sitemaps while rejecting editorial URLs", async () => {
  const accepted = [
    "/GUIDES/getting-started",
    "/documentation/api",
    "/help-center/billing",
    "/faqs/accounts",
    "/case_studies/acme",
    "/resources/toolkit",
    "/academy/courses",
  ];
  const ignored = [
    "/blog/launch",
    "/news/update",
    "/articles/advice",
    "/posts/announcement",
    "/author/editor",
    "/tags/growth",
    "/category/seo",
    "/2025/07/25/release",
  ];
  const links = [...accepted, ...ignored]
    .map((path) => `<a href="${path}">${path}</a>`)
    .join("");
  for (const source of ["html", "sitemap"] as const) {
    const fetchedPaths: string[] = [];
    const result = await crawlBusinessWebsite("https://example.test", undefined, {
      assertSafe: async () => undefined,
      fetchSitemap: async (url) => source === "sitemap" ? {
        resolvedUrl: url,
        xml: `<urlset>${[...accepted, ...ignored].map((path) => `<url><loc>https://example.test${path}?source=sitemap</loc></url>`).join("")}</urlset>`,
      } : null,
      fetchPage: async (url) => {
        fetchedPaths.push(url.pathname);
        if (url.pathname !== "/" && PRIORITY_FETCH_PATHS.includes(url.pathname)) return null;
        return { resolvedUrl: url, html: page(url.pathname === "/" ? "Acme" : url.pathname, source === "html" && url.pathname === "/" ? links : "") };
      },
    });

    assert.equal(result.diagnostics.pagesDiscovered, 19, source);
    if (source === "html") {
      assert.ok(accepted.every((path) => fetchedPaths.includes(path)), source);
      assert.ok(accepted.every((path) => result.pages.some((pageResult) => new URL(pageResult.url).pathname === path)), source);
    }
    assert.ok(ignored.every((path) => !fetchedPaths.includes(path)), source);
  }
});

test("rejects chronological editorial paths without rejecting business pages ending in a year", async () => {
  const accepted = ["/awards/2025", "/pricing/2026", "/company-history/1998", "/annual-report/2024"];
  const ignored = ["/2025/07/25/post", "/2025/07/post", "/2025/post-title", "/blog/2025/post", "/news/2024/update"];
  const links = [...accepted, ...ignored]
    .map((path) => `<a href="${path}">Customer information</a>`)
    .join("");
  const fetchedPaths: string[] = [];

  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      fetchedPaths.push(url.pathname);
      if (url.pathname !== "/" && PRIORITY_FETCH_PATHS.includes(url.pathname)) return null;
      if (url.pathname === "/") return { resolvedUrl: url, html: page("Acme", links) };
      return { resolvedUrl: url, html: `<title>${url.pathname}</title><main>${`${url.pathname} durable company awards pricing and annual business information. `.repeat(10)}</main>` };
    },
  });

  assert.ok(accepted.every((path) => fetchedPaths.includes(path)));
  assert.ok(accepted.every((path) => result.pages.some((item) => new URL(item.url).pathname === path)));
  assert.ok(ignored.every((path) => !fetchedPaths.includes(path)));
  assert.ok(ignored.every((path) => !result.pages.some((item) => new URL(item.url).pathname === path)));
});

const PRIORITY_FETCH_PATHS = [
  "/", "/about", "/about-us", "/services", "/products", "/pricing",
  "/faq", "/faqs", "/contact", "/contact-us", "/policies", "/terms",
];

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
  assert.equal(fallback.pages.length, 1);
  assert.equal(fallback.diagnostics.exactDuplicatesSkipped, 11);
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
  assert.equal(result.pages.length, 1);
  assert.equal(result.diagnostics.exactDuplicatesSkipped, 11);
  assert.equal(result.diagnostics.pagesDiscovered, 12);
  assert.deepEqual(pageCalls, PRIORITY_FETCH_PATHS);
  assert.ok(!pageCalls.some((pathname) => pathname.startsWith("/page-")));
});

test("discovers durable same-domain PDFs from HTML and sitemaps with an independent cap", async () => {
  const pdfCalls: string[] = [];
  const htmlCalls: string[] = [];
  const links = [
    '<a href="/brochure.pdf">Company brochure</a>',
    '<a href="/menu.pdf">Dining menu</a>',
    '<a href="/pricing-guide.pdf">Pricing guide</a>',
    '<a href="/service-manual.pdf">Service manual</a>',
    '<a href="https://external.test/catalog.pdf">Product catalog</a>',
    '<a href="/newsletter.pdf">Newsletter</a>',
    '<a href="/random.pdf">Download</a>',
    '<a href="/service.docx">Service document</a>',
  ].join("");
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchPage: async (url) => { htmlCalls.push(url.pathname); return url.pathname === "/" ? { resolvedUrl:url, html:page("Acme", links) } : null; },
    fetchSitemap: async (url) => ({ resolvedUrl:url, xml:'<urlset><url><loc>https://example.test/brochure.pdf</loc></url><url><loc>https://example.test/policy.pdf</loc></url></urlset>' }),
    fetchPdf: async (url) => { pdfCalls.push(url.pathname); return { resolvedUrl:url, bytes:new Uint8Array([37,80,68,70,45]), truncated:false }; },
    parsePdf: async () => ({ text:"Durable service pricing policies and customer information. ".repeat(4), title:"Acme Reference", pagesParsed:2, truncated:false }),
  });
  assert.deepEqual(pdfCalls, ["/brochure.pdf", "/menu.pdf", "/pricing-guide.pdf"]);
  assert.equal(result.diagnostics.pdfsDiscovered, 5);
  assert.equal(result.diagnostics.pdfsProcessed, 1);
  assert.equal(result.diagnostics.pdfsSkipped, 4);
  assert.equal(result.diagnostics.pdfBytesDownloaded, 15);
  assert.equal(result.diagnostics.pdfPagesParsed, 6);
  assert.equal(result.diagnostics.pagesProcessed, 1);
  assert.equal(result.pages[0]?.pageType, "home");
  assert.equal(result.pages.at(-1)?.pageType, "document");
  assert.ok(!htmlCalls.some((path) => path.endsWith(".pdf") || path.endsWith(".docx")));
});

test("retains normalized PDF text, uses filename titles, and isolates parser failures", async () => {
  let parsed = 0;
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:page("Acme",'<a href="/service-catalog.pdf">Catalog</a><a href="/policy-guide.pdf">Policy guide</a>')}:null,
    fetchPdf:async(url)=>({resolvedUrl:url,bytes:new Uint8Array(100),truncated:false}),
    parsePdf:async()=>{ parsed += 1; if(parsed===2) throw new Error("sensitive parser internals"); return {text:`  Service catalog\0   details\n\n\n${"pricing and capabilities ".repeat(5)}`,title:"Untitled",pagesParsed:75,truncated:true}; },
  });
  const document=result.pages.find(item=>item.pageType==="document")!;
  assert.equal(document.title,"Service Catalog");
  assert.doesNotMatch(document.text,/\0| {2}|\n{3}/);
  assert.equal(result.diagnostics.pdfsProcessed,1);
  assert.equal(result.diagnostics.pdfsFailed,1);
  assert.equal(result.diagnostics.pdfDocumentsTruncated,1);
  assert.deepEqual(result.warnings,["A PDF document could not be read."]);
});

test("discovers a PDF from weak HTML without retaining or budgeting the weak page", async () => {
  const fetchedPaths: string[] = [];
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => {
      fetchedPaths.push(url.pathname);
      if (url.pathname === "/") return { resolvedUrl:url, html:'<a href="/downloads/service-catalog.pdf">Download our service catalog</a>' };
      if (url.pathname === "/about") return { resolvedUrl:url, html:page("About Acme") };
      return null;
    },
    fetchPdf: async (url) => ({ status:"success", document:{ resolvedUrl:url, bytes:new Uint8Array([37,80,68,70,45]), truncated:false } }),
    parsePdf: async () => ({ text:"Service catalog pricing and capabilities. ".repeat(4), pagesParsed:1, truncated:false }),
  });
  assert.equal(result.pages.some((item) => item.url === "https://example.test/"), false);
  assert.equal(result.pages.filter((item) => item.pageType === "document").length, 1);
  assert.equal(result.diagnostics.pagesSkipped, 1);
  assert.equal(result.diagnostics.pdfsProcessed, 1);
  assert.equal(fetchedPaths.filter((path) => path === "/downloads/service-catalog.pdf").length, 0);
});

test("accepts strongly signaled PDF delivery URLs but rejects generic downloads", async () => {
  const pdfCalls: string[] = [];
  const links = [
    '<a href="/download?file=pricing-guide.pdf">Pricing guide</a>',
    '<a href="/documents/pricing-guide">View pricing guide PDF</a>',
    '<a href="/assets/view?id=123">Brochure PDF</a>',
    '<a href="/download?id=generic">Download document</a>',
  ].join("");
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:page("Acme",links)}:null,
    fetchPdf:async(url)=>{ pdfCalls.push(`${url.pathname}${url.search}`); return { status:"success", document:{resolvedUrl:url,bytes:new Uint8Array(5),truncated:false} }; },
    parsePdf:async()=>({text:"Distinct durable pricing policy and service details. ".repeat(4),pagesParsed:1,truncated:false}),
  });
  assert.deepEqual(pdfCalls,["/download?file=pricing-guide.pdf","/documents/pricing-guide","/assets/view?id=123"]);
  assert.equal(result.diagnostics.pdfsDiscovered,3);
});

test("separates skipped PDF validation outcomes from eligible fetch failures", async () => {
  let call = 0;
  const links = '<a href="/pricing.pdf">Pricing</a><a href="/services.pdf">Services</a><a href="/policy.pdf">Policy</a>';
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:page("Acme",links)}:null,
    fetchPdf:async()=>{ call += 1; return call === 1 ? {status:"skipped"} : {status:"failed"}; },
  });
  assert.equal(result.diagnostics.pdfsSkipped,1);
  assert.equal(result.diagnostics.pdfsFailed,2);
  assert.deepEqual(result.warnings,["A PDF document could not be read."]);
  assert.equal(result.pages.some((item)=>item.pageType==="home"),true);
});

test("keeps HTML authoritative and renders only deterministically weak pages", async () => {
  const rendered: string[] = [];
  const rich = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:page("Acme")}:null,
    renderPage:async(url)=>{ rendered.push(url.pathname); return null; },
  });
  assert.equal(rendered.length, 0);
  assert.equal(rich.diagnostics.browserPagesQueued, 0);

  const weak = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:'<title>Loading</title><div id="root"></div>'}:null,
    renderPage:async(url)=>{ rendered.push(url.pathname); return {resolvedUrl:url,html:`<title>Acme</title><main><h1>Acme Services</h1><p>${"Emergency repairs, installation, pricing, and service throughout Dallas. ".repeat(5)}</p></main>`}; },
  });
  assert.deepEqual(rendered, ["/"]);
  assert.match(weak.pages[0]!.text, /Emergency repairs/);
  assert.equal(weak.diagnostics.browserPagesQueued, 1);
  assert.equal(weak.diagnostics.browserPagesRendered, 1);
  assert.equal(weak.diagnostics.browserFallbacksUsed, 1);
  assert.ok(weak.diagnostics.browserRenderDurationMs >= 0);
  assert.equal(weak.diagnostics.headingsRetained, 1);
  assert.equal(weak.diagnostics.paragraphsRetained, 1);
});

test("does not replace weak HTML with empty rendered output", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:`<main>${"Original business details. ".repeat(4)}</main>`}:url.pathname==="/about"?{resolvedUrl:url,html:page("About")}:null,
    renderPage:async(url)=>({resolvedUrl:url,html:'<div id="root"></div>'}),
  });
  assert.ok(result.pages.some(item=>item.text.includes("Original business details")));
  assert.equal(result.diagnostics.browserFallbacksUsed, 0);
  assert.equal(result.diagnostics.browserPagesSkipped, 1);
});

test("rejects oversized rendered HTML without losing other crawl pages", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe: async () => undefined,
    fetchSitemap: async () => null,
    fetchPage: async (url) => url.pathname === "/"
      ? { resolvedUrl: url, html: '<div id="app"></div>' }
      : url.pathname === "/about" ? { resolvedUrl: url, html: page("About") } : null,
    renderPage: async (url) => ({ resolvedUrl: url, html: `<main>${"x".repeat(750_001)}</main>` }),
  });
  assert.ok(result.pages.some((item) => item.pageType === "about"));
  assert.equal(result.diagnostics.browserRenderFailures, 1);
  assert.ok(result.diagnostics.restrictions.some((item) => item.type === "response_too_large"));
});

test("isolates browser timeouts and failures while continuing the crawl", async () => {
  let calls = 0;
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null, browserLimits:{renderTimeoutMs:5},
    fetchPage:async(url)=>url.pathname==="/"||url.pathname==="/about"||url.pathname==="/services"?{resolvedUrl:url,html:`<title>${url.pathname}</title><div id="app"></div>`}:null,
    renderPage:async(url)=>{ calls += 1; if(url.pathname==="/") return await new Promise(()=>{}); if(url.pathname==="/about") throw new Error("secret browser failure"); return {resolvedUrl:url,html:`<main>${"Rendered service information. ".repeat(8)}</main>`}; },
  });
  assert.equal(calls, 3);
  assert.equal(result.diagnostics.browserRenderTimeouts, 1);
  assert.equal(result.diagnostics.browserRenderFailures, 1);
  assert.equal(result.diagnostics.browserFallbacksUsed, 1);
  assert.equal(result.warnings.filter(item=>item.includes("JavaScript-rendered")).length, 1);
  assert.ok(!result.warnings.some(item=>item.includes("secret")));
});

test("enforces browser page and total-time budgets", async () => {
  let pageLimited = 0;
  const limited = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null, browserLimits:{pages:2},
    fetchPage:async(url)=>({resolvedUrl:url,html:'<div id="app"></div>'}),
    renderPage:async(url)=>{ pageLimited += 1; return {resolvedUrl:url,html:`<main>${url.pathname} ${"distinct rendered business information ".repeat(8)}</main>`}; },
  });
  assert.equal(pageLimited, 2);
  assert.ok(limited.diagnostics.browserPagesSkipped > 0);

  let clock = 0, timeLimited = 0;
  const timed = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null, now:()=>clock, browserLimits:{pages:10,totalTimeMs:10},
    fetchPage:async(url)=>({resolvedUrl:url,html:'<div id="app"></div>'}),
    renderPage:async(url)=>{ timeLimited += 1; clock += 10; return {resolvedUrl:url,html:`<main>${url.pathname} ${"timed rendered company information ".repeat(8)}</main>`}; },
  });
  assert.equal(timeLimited, 1);
  assert.equal(timed.diagnostics.browserRenderDurationMs, 10);
  assert.ok(timed.diagnostics.browserPagesSkipped > 0);
});

test("runs canonical, JSON-LD, semantic, and duplicate handling after rendering", async () => {
  const facts = JSON.stringify({"@type":"Organization",name:"Rendered Acme",telephone:"555-0100"});
  const renderedHtml = `<link rel="canonical" href="https://example.test/services"><main><h1>Rendered Services</h1><p>${"Installation repair maintenance pricing warranty and scheduling. ".repeat(5)}</p></main><script type="application/ld+json">${facts}</script>`;
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"||url.pathname==="/about"?{resolvedUrl:url,html:'<div id="root"></div>'}:null,
    renderPage:async(url)=>({resolvedUrl:url,html:renderedHtml}),
  });
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0]!.url, "https://example.test/services");
  assert.match(result.pages[0]!.text, /Rendered Services/);
  assert.match(result.pages[0]!.text, /Business name: Rendered Acme/);
  assert.equal(result.diagnostics.canonicalUrlsDetected, 2);
  assert.equal(result.diagnostics.canonicalDuplicatesSkipped, 1);
  assert.equal(result.diagnostics.jsonLdBlocksParsed, 2);
  assert.equal(result.diagnostics.headingsRetained, 1);
});

test("production browser routing blocks cross-host, unsafe, and non-http subresources", async () => {
  let routeHandler: ((route: { request:()=>{url:()=>string}; abort:()=>Promise<void>; continue:()=>Promise<void> })=>Promise<void>) | undefined;
  let browserClosed = 0;
  let launchArgs: string[] | undefined;
  let contextOptions: { javaScriptEnabled: boolean; serviceWorkers: "block" } | undefined;
  let webSocketHandler: ((socket: { close: () => Promise<void> }) => Promise<void>) | undefined;
  let serializedCharacters = 100;
  let contentCalls = 0;
  const renderer = await createPlaywrightRenderer(async (url) => {
    if (url.pathname === "/unsafe.js") throw new Error("Unsafe crawler destination.");
    return { address: "93.184.216.34", family: 4 };
  }, "example.test", async () => ({ chromium:{ launch:async(options)=>{
    launchArgs=options.args;
    return {
      newContext:async(options)=>{contextOptions=options;return{
        route:async(_pattern,handler)=>{ routeHandler=handler; },
        routeWebSocket:async(_pattern,handler)=>{ webSocketHandler=handler; },
        newPage:async()=>({goto:async()=>undefined,evaluate:async<Result>()=>serializedCharacters as unknown as Result,
        content:async()=>{contentCalls += 1;return "<main>Rendered</main>";}, url:()=>"https://example.test/",
      })};},
      close:async()=>{ browserClosed += 1; },
    };
  } } }));
  assert.ok(routeHandler);
  assert.ok(webSocketHandler);
  assert.deepEqual(launchArgs, ["--no-proxy-server", "--host-resolver-rules=MAP example.test 93.184.216.34"]);
  assert.deepEqual(contextOptions, { javaScriptEnabled: true, serviceWorkers: "block" });
  let webSocketClosed = false;
  await webSocketHandler!({ close: async () => { webSocketClosed = true; } });
  assert.equal(webSocketClosed, true);
  const outcome = async (url: string) => {
    let result = "";
    await routeHandler!({request:()=>({url:()=>url}),abort:async()=>{result="abort";},continue:async()=>{result="continue";}});
    return result;
  };
  assert.equal(await outcome("https://example.test/app.js"), "continue");
  assert.equal(await outcome("https://cdn.example.test/app.js"), "abort");
  assert.equal(await outcome("https://example.test/unsafe.js"), "abort");
  assert.equal(await outcome("data:text/javascript,alert(1)"), "abort");
  serializedCharacters = 750_001;
  await assert.rejects(renderer.render(new URL("https://example.test/"), 100), /exceeds the extraction limit/);
  assert.equal(contentCalls, 0);
  await renderer.close();
  assert.equal(browserClosed, 1);
});

test("production browser initialization closes a partially created browser", async () => {
  let closed = 0;
  await assert.rejects(createPlaywrightRenderer(async()=>undefined, "example.test", async()=>({chromium:{launch:async()=>({
    newContext:async()=>{ throw new Error("context setup failed"); },
    close:async()=>{ closed += 1; },
  })}})), /context setup failed/);
  assert.equal(closed, 1);
});

test("rejects a rendered redirect outside the crawl host", async () => {
  const result = await crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:'<div id="app"></div>'}:url.pathname==="/about"?{resolvedUrl:url,html:page("About")}:null,
    renderPage:async()=>({resolvedUrl:new URL("https://outside.test/landing"),html:`<main>${"Outside content. ".repeat(20)}</main>`}),
  });
  assert.equal(result.diagnostics.browserRenderFailures, 1);
  assert.equal(result.diagnostics.browserFallbacksUsed, 0);
  assert.ok(result.pages.every(item=>!item.url.includes("outside.test")));
});

test("always closes a created renderer when the crawl later throws", async () => {
  let closed = 0;
  await assert.rejects(crawlBusinessWebsite("https://example.test", undefined, {
    assertSafe:async()=>undefined, fetchSitemap:async()=>null,
    fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:'<div id="app"></div>'}:null,
    createBrowserRenderer:async()=>({render:async()=>null,close:async()=>{closed += 1;}}),
  }), BusinessWebsiteCrawlError);
  assert.equal(closed, 1);
});

test("browser initialization and render failures fall back without failing the crawl", async () => {
  for (const mode of ["initialize", "render"] as const) {
    let closed = 0;
    const result = await crawlBusinessWebsite("https://example.test", undefined, {
      assertSafe:async()=>undefined, fetchSitemap:async()=>null,
      fetchPage:async(url)=>url.pathname==="/"?{resolvedUrl:url,html:`<main>${"Original details. ".repeat(5)}</main>`}:url.pathname==="/about"?{resolvedUrl:url,html:page("About")}:null,
      createBrowserRenderer:async()=>{
        if(mode==="initialize") throw new Error("initialization detail");
        return {render:async()=>{throw new Error("render detail");},close:async()=>{closed += 1;}};
      },
    });
    assert.ok(result.pages.some(item=>item.text.includes("Original details")));
    assert.equal(result.diagnostics.browserRenderFailures, 1);
    assert.deepEqual(result.warnings.filter(item=>item.includes("JavaScript-rendered")), ["A JavaScript-rendered page could not be processed."]);
    assert.equal(closed, mode === "render" ? 1 : 0);
  }
});
