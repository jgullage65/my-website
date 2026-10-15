import type {
  WebsiteKnowledgeFact,
  PersistedWebsiteKnowledge,
} from "../knowledge/websiteKnowledge";
import type {
  WebsiteCrawlAttemptRecord,
  WebsiteSourceDocumentRecord,
  WebsiteSourceBlockRecord,
} from "../crawler/websiteSourceRecords";

/** Identity is transient query/matching input, never a source of research claims. */
export type BusinessIdentity = {
  name: string;
  category?: string;
  city?: string;
  state?: string;
  address?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  phone?: string;
  placeId?: string;
  registrationId?: string;
  registrationAuthority?: string;
  branch?: string;
  formerNames?: string[];
};
export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const text = (v: unknown, max = 500): string =>
  typeof v === "string"
    ? v.replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
export function parseIdentity(value: unknown): BusinessIdentity | null {
  const raw = object(value),
    name = text(raw.name, 200);
  if (!name) return null;
  const identity: BusinessIdentity = { name };
  for (const key of [
    "category",
    "city",
    "state",
    "address",
    "country",
    "postalCode",
    "website",
    "phone",
    "placeId",
    "registrationId",
    "registrationAuthority",
    "branch",
  ] as const) {
    const value = text(raw[key], key === "website" ? 2048 : 300);
    if (value) identity[key] = value;
  }
  if (Array.isArray(raw.formerNames))
    identity.formerNames = raw.formerNames
      .slice(0, 5)
      .map((v) => text(v, 200))
      .filter(Boolean);
  return identity;
}
export type ClaimScope = "legal_entity" | "business_location";
export type Match = {
  scope?: ClaimScope;
  classification:
    | "confirmed"
    | "ambiguous"
    | "rejected"
    | "insufficient_evidence";
  signals: string[];
};
export type SourcePolicy = {
  id: string;
  origin: string;
  paths: string[];
  authority: "official_record" | "first_party" | "directory";
  independenceGroup: string;
  reviewedAt: string;
  expiresAt: string;
  permissionUrls: string[];
  rights: {
    access: boolean;
    automate: boolean;
    extract: boolean;
    storeContent: boolean;
    retainFacts: boolean;
    commercialUse: boolean;
  };
  minIntervalMs: number;
  maxBytes: number;
  excluded?: boolean;
};
export type ResearchFact = WebsiteKnowledgeFact & {
  provenance?: "public_record" | "external_source";
  evidence: (WebsiteKnowledgeFact["evidence"][number] & { provenance?: "public_record" | "external_source" })[];
  research: {
    claimScope?: ClaimScope;
    validatedAt?: string;
    sourceKind: SourcePolicy["authority"];
    independenceGroups: string[];
    retrievedAt: string;
    effectiveAt?: string;
    state: "supported" | "uncertain" | "conflicting" | "stale";
    match: Match;
    policyId: string;
    corroboration: "single_source" | "independent_sources" | "shared_origin";
  };
};
export type Candidate = {
  url: string;
  policyId: string;
  discoveredBy: string;
  discoveredFrom: string;
};
export type SourceOutcome = {
  url: string;
  policyId: string;
  state: string;
  reason?: string;
  match?: Match;
  discoveredBy?: string;
  fingerprint?: string;
  identityVersion?: 1;
  sourceIdentity?: BusinessIdentity;
  etag?: string;
  lastModified?: string;
};
export type ResearchSnapshot = {
  schemaVersion: 1;
  attempt: WebsiteCrawlAttemptRecord;
  facts: ResearchFact[];
  documents: WebsiteSourceDocumentRecord[];
  blocks: WebsiteSourceBlockRecord[];
  pages: {
    url: string;
    title: string;
    pageType: string;
    sourceDocumentId: string;
  }[];
  outcomes: SourceOutcome[];
  coverage: PersistedWebsiteKnowledge["knowledge"]["coverage"];
  unresolvedQuestions: string[];
  reconciliation?: unknown;
  metrics: {
    requests: number;
    bytes: number;
    durationMs: number;
    aiCalls: 0;
    inputTokens: 0;
    outputTokens: 0;
    paidRequests: 0;
  };
};
export type ResearchState =
  | "full_website"
  | "website_with_supplements"
  | "limited_public_sources"
  | "existing_lead_facts"
  | "insufficient_evidence";
