import { registryRecord } from "./localRegistries";
import {
  semanticHtml,
  extractJsonLd,
  parsePdf,
} from "../crawler/crawlBusinessWebsite";
import {
  buildTextBlocks,
  sha256,
  stableSourceDocumentId,
  type WebsiteSourceDocumentRecord,
  type WebsiteSourceBlockRecord,
} from "../crawler/websiteSourceRecords";
import { buildDeterministicBusinessBrain } from "../deterministic";
import { gleifIdentity } from "./adapters";
import {
  object,
  text,
  type BusinessIdentity,
  type Candidate,
  type ResearchFact,
  type SourcePolicy,
  type Match,
} from "./contracts";
import type { ResearchFetcher } from "./transport";

export function identityFromJsonLd(html: string): BusinessIdentity[] {
  const entities: BusinessIdentity[] = [];
  let visited = 0;
  const visit = (value: unknown, depth = 0) => {
    if (++visited > 250 || depth > 8 || !value || typeof value !== "object")
      return;
    if (Array.isArray(value)) {
      value.slice(0, 100).forEach((v) => visit(v, depth + 1));
      return;
    }
    const node = object(value),
      types = (
        Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]
      ).map((v) => text(v));
    if (
      types.some((t) =>
        /Organization|LocalBusiness|Store|Restaurant|Service|Clinic|Hotel|Agency|Company/i.test(
          t,
        ),
      ) &&
      text(node.name)
    ) {
      const address = object(node.address);
      entities.push({
        name: text(node.name),
        website: text(node.url),
        phone: text(node.telephone),
        address: text(address.streetAddress),
        city: text(address.addressLocality),
        state: text(address.addressRegion),
        postalCode: text(address.postalCode),
        country: text(address.addressCountry),
      });
    }
    Object.values(node).forEach((v) => {
      if (v && typeof v === "object") visit(v, depth + 1);
    });
  };
  for (const match of Array.from(
    html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  )) {
    try {
      visit(JSON.parse(match[1]!));
    } catch {
      /* Malformed JSON-LD is not evidence. */
    }
  }
  return entities;
}
const parsedDocuments = new WeakMap<
  object,
  Awaited<ReturnType<typeof parsePdf>>
>();
export async function sourceIdentities(
  candidate: Candidate,
  response: Awaited<ReturnType<ResearchFetcher["get"]>>,
): Promise<BusinessIdentity[]> {
  const local = registryRecord(candidate.policyId, response.text, candidate.url);
  if (local) return [local.identity];
  if (candidate.policyId.startsWith("gleif-"))
    return [gleifIdentity(object(JSON.parse(response.text)).data)];
  if (
    response.headers.get("content-type")?.split(";")[0] === "application/pdf"
  ) {
    const pdf = await parsePdf(response.bytes);
    parsedDocuments.set(response, pdf);
    const field = (label: string) =>
      pdf.text
        .match(
          new RegExp(
            "(?:^|\\s)" +
              label +
              ":\\s*(.+?)(?=\\s+(?:Business name|Legal name|Street address|Address|City|State|Country|Phone|Telephone):|$)",
            "i",
          ),
        )?.[1]
        ?.trim() ?? "";
    const name = field("Business name") || field("Legal name");
    return name
      ? [
          {
            name,
            address: field("Street address") || field("Address"),
            city: field("City"),
            state: field("State"),
            country: field("Country"),
            phone: field("Telephone") || field("Phone"),
          },
        ]
      : [];
  }
  return identityFromJsonLd(response.text);
}
export async function extractApprovedSource(input: {
  candidate: Candidate;
  policy: SourcePolicy;
  response: Awaited<ReturnType<ResearchFetcher["get"]>>;
  attemptId: string;
  match: Match;
  fetchedAt: string;
}) {
  const { candidate, policy, response, attemptId, match, fetchedAt } = input;
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  let content = "",
    title = "",
    structured = "",
    pdf: Awaited<ReturnType<typeof parsePdf>> | undefined;
  const isGleif = policy.id.startsWith("gleif-");
  const local = registryRecord(policy.id, response.text, candidate.url);
  const isRegistry = isGleif || !!local;
  const direct: {
    category: ResearchFact["category"];
    title: string;
    value: string;
  }[] = [];
  if (local) {
    title = local.identity.name;
    direct.push(...local.facts);
    content = direct.map(f => f.value).join("\n");
  } else if (isGleif) {
    const record = object(object(JSON.parse(response.text)).data),
      attributes = object(record.attributes),
      entity = object(attributes.entity),
      registration = object(attributes.registration),
      identity = gleifIdentity(record);
    if (
      text(record.id) !== new URL(candidate.url).pathname.split("/").pop() ||
      !/^[A-Z0-9]{20}$/.test(text(record.id)) ||
      !identity.name
    )
      throw new Error("invalid_gleif_record");
    title = identity.name;
    const add = (
      category: ResearchFact["category"],
      label: string,
      value: unknown,
    ) => {
      const v = text(value);
      if (v) direct.push({ category, title: label, value: label + ": " + v });
    };
    add("company_overview", "Registered legal name", identity.name);
    add(
      "business_identity",
      "Legal Entity Identifier",
      attributes.lei ?? record.id,
    );
    add(
      "business_identity",
      "Registered legal address",
      [
        identity.address,
        identity.city,
        identity.state,
        identity.postalCode,
        identity.country,
      ]
        .filter(Boolean)
        .join(", "),
    );
    add("business_identity", "Legal entity status", entity.status);
    add("business_identity", "LEI registration status", registration.status);
    // LEI registration is neither a professional license nor proof of an active storefront.
    content = direct.map((f) => f.value).join("\n");
  } else if (contentType === "application/pdf") {
    pdf = parsedDocuments.get(response) ?? (await parsePdf(response.bytes));
    content = pdf.text;
    title = pdf.title ?? "Public business document";
  } else {
    const semantic = semanticHtml(response.text),
      jsonld = extractJsonLd(response.text);
    content = semantic.text;
    structured = jsonld.text;
    title = semantic.h1 || "Public business source";
  }
  const sourceContentHash = sha256(response.bytes),
    extractedContentHash = sha256(content + "\n" + structured),
    id = stableSourceDocumentId(attemptId, response.url, sourceContentHash);
  const document: WebsiteSourceDocumentRecord = {
    schemaVersion: 1,
    id,
    crawlAttemptId: attemptId,
    actualFetchedUrl: response.url,
    canonicalUrl: null,
    redirectChain: response.chain,
    // Registry data is converted into semantic evidence blocks, not represented as a website crawl.
    sourceType: pdf ? "pdf" : "html",
    contentType,
    status: "retained",
    fetchedAt,
    sourceContentHash,
    extractedContentHash,
    language: null,
    sourceTruncated: false,
    extractionTruncated: pdf?.truncated ?? false,
    discoveryMethod: "unknown",
    discoveredFromUrl: candidate.discoveredFrom,
  };
  const blocks: WebsiteSourceBlockRecord[] = pdf
    ? (pdf.pages ?? []).flatMap((p) =>
        buildTextBlocks({
          documentId: id,
          attemptId,
          text: p.text,
          method: "pdf_text",
          type: "pdf_page_text",
          pageNumber: p.pageNumber,
        }),
      )
    : buildTextBlocks({
        documentId: id,
        attemptId,
        text: content,
        method: "semantic_html",
      });
  if (structured)
    blocks.push(
      ...buildTextBlocks({
        documentId: id,
        attemptId,
        text: structured,
        method: "json_ld",
        type: "json_ld_fact",
      }),
    );
  const pages = [
    {
      url: response.url,
      title,
      pageType: isRegistry ? "public_record" : "external_source",
      sourceDocumentId: id,
      text: content + (structured ? "\n" + structured : ""),
      crawlAttemptId: attemptId,
    },
  ];
  const brain = buildDeterministicBusinessBrain({
    pages,
    sourceDocuments: [document],
    sourceBlocks: blocks,
  });
  const raw = isRegistry
    ? direct.map((f) => ({
        ...f,
        confidence: "medium" as const,
        evidence: [
          {
            url: response.url,
            excerpt: f.value,
            sourceDocumentId: id,
            sourceBlockId: blocks.find((b) => b.normalizedText === f.value)?.id,
            crawlAttemptId: attemptId,
          },
        ],
      }))
    : brain.websiteKnowledge.facts;
  const claimScope = isGleif || (isRegistry && !policy.id.startsWith("seattle-")) ? "legal_entity" as const : "business_location" as const;
  const provenance = policy.authority === "official_record" ? "public_record" as const : "external_source" as const;
  const facts: ResearchFact[] = raw
    .filter(
      (f) =>
        (match.scope !== "legal_entity" || claimScope === "legal_entity") &&
        !/^The website contains/i.test(f.value) &&
        f.evidence.length &&
        f.evidence.every((e) =>
          blocks.some(
            (b) =>
              b.sourceDocumentId === id && b.normalizedText.includes(e.excerpt),
          ),
        ),
    )
    .slice(0, 60)
    .map((f) => ({
      ...f,
      provenance,
      evidence: f.evidence.map(e => ({...e, provenance})),
      confidence:
        f.confidence === "high" && policy.authority === "directory"
          ? "medium"
          : f.confidence,
      research: {
        claimScope,
        sourceKind: policy.authority,
        independenceGroups: [policy.independenceGroup],
        retrievedAt: fetchedAt,
        state: "supported",
        match,
        policyId: policy.id,
        corroboration: "single_source",
      },
    }));
  return {
    document,
    blocks,
    facts,
    pages: pages.map(({ text, crawlAttemptId, ...page }) => page),
    coverage: brain.websiteKnowledge.coverage,
    unresolvedQuestions: brain.websiteKnowledge.unresolvedQuestions,
  };
}
