import {
  type BusinessIdentity,
  type Candidate,
  type SourcePolicy,
  object,
  text,
} from "./contracts";
import { GLEIF_POLICY } from "./policy";
import { ResearchFetcher, RESEARCH_LIMITS } from "./transport";
export type SourceAdapter = {
  supplies?: string[];
  minimumRequests?: number;
  priority?: number;
  applicable?: (identity: BusinessIdentity) => boolean;
  id: string;
  policy: SourcePolicy;
  discover(
    identity: BusinessIdentity,
    fetcher: ResearchFetcher,
  ): Promise<Candidate[]>;
};
export function gleifIdentity(record: unknown): BusinessIdentity {
  const attributes = object(object(record).attributes),
    entity = object(attributes.entity),
    address = object(entity.legalAddress),
    registration = object(entity.registeredAt);
  return {
    name: text(object(entity.legalName).name),
    address: Array.isArray(address.addressLines)
      ? address.addressLines
          .map((v) => text(v))
          .filter(Boolean)
          .join(" ")
      : "",
    city: text(address.city),
    state: text(address.region),
    postalCode: text(address.postalCode),
    country: text(address.country),
    registrationId: text(entity.registeredAs),
    registrationAuthority: text(registration.id),
  };
}
export const gleifAdapter: SourceAdapter = {
  id: "gleif-legal-entity-search",
  minimumRequests: 3,
  supplies: ["business_identity", "company_overview"],
  policy: GLEIF_POLICY,
  async discover(identity, fetcher) {
    const url = new URL("/api/v1/lei-records", GLEIF_POLICY.origin);
    url.searchParams.set("filter[entity.legalName]", identity.name);
    url.searchParams.set("page[size]", String(RESEARCH_LIMITS.candidates));
    if (identity.country && /^[A-Z]{2}$/i.test(identity.country))
      url.searchParams.set(
        "filter[entity.legalAddress.country]",
        identity.country.toUpperCase(),
      );
    const response = await fetcher.get(url.href, GLEIF_POLICY),
      payload = object(JSON.parse(response.text));
    if (!Array.isArray(payload.data))
      throw new Error("invalid_gleif_search_response");
    return payload.data.slice(0, RESEARCH_LIMITS.candidates).flatMap((item) => {
      const id = text(object(item).id, 30);
      if (!/^[A-Z0-9]{20}$/.test(id)) return [];
      // Search results are candidates only; matching and acceptance happen after independent record retrieval.
      return [
        {
          url: GLEIF_POLICY.origin + "/api/v1/lei-records/" + id,
          policyId: GLEIF_POLICY.id,
          discoveredBy: "gleif_name_filter",
          discoveredFrom: url.origin + url.pathname,
        },
      ];
    });
  },
};

/** A reusable bounded published-index adapter. Its policy must be separately reviewed before registration. */
export function publishedIndexAdapter(
  id: string,
  policy: SourcePolicy,
  indexUrl: string,
): SourceAdapter {
  return {
    id,
    minimumRequests: 3,
    policy,
    async discover(identity, fetcher) {
      const response = await fetcher.get(indexUrl, policy);
      const urls = Array.from(
        response.text.matchAll(
          /<loc>\s*([^<]+)\s*<\/loc>|<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        ),
      ).slice(0, 2000);
      const words = identity.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2);
      return Array.from(
        new Set(
          urls
            .filter(
              (m) =>
                words.length > 0 &&
                words.every((w) =>
                  `${m[1] ?? ""} ${m[2] ?? ""} ${m[3] ?? ""}`
                    .toLowerCase()
                    .includes(w),
                ),
            )
            .flatMap((m) => {
              try {
                return [
                  new URL(
                    (m[1] ?? m[2] ?? "").replace(/&amp;/g, "&"),
                    response.url,
                  ).href,
                ];
              } catch {
                return [];
              }
            }),
        ),
      )
        .slice(0, RESEARCH_LIMITS.candidates)
        .map((url) => ({
          url,
          policyId: policy.id,
          discoveredBy: id,
          discoveredFrom: indexUrl,
        }));
    },
  };
}
