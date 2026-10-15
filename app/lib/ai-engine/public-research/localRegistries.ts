import { object, text, type BusinessIdentity, type SourcePolicy, type ResearchFact } from "./contracts";
import type { SourceAdapter } from "./adapters";
import { RESEARCH_LIMITS } from "./limits";

type Registry = {
  id: string; origin: string; dataset: string; license: string; publisher: string;
  names: string[]; key: string; applies(identity: BusinessIdentity): boolean;
};
const washington = (i: BusinessIdentity) => /^(?:WA|US-WA|Washington)$/i.test(i.state ?? "") && (!i.country || /^(?:US|USA|United States)$/i.test(i.country));
const registries: Registry[] = [
  { id: "seattle-business-license-public-domain", origin: "https://data.seattle.gov", dataset: "wnbq-64tb", license: "PUBLIC_DOMAIN", publisher: "Seattle Department of Finance and Administrative Services", names: ["business_legal_name", "trade_name"], key: "city_account_number", applies: i => washington(i) && /^seattle$/i.test(i.city ?? "") },
  { id: "washington-contractor-license-pddl", origin: "https://data.wa.gov", dataset: "m8qx-ubtq", license: "PDDL", publisher: "Washington Department of Labor & Industries", names: ["businessname"], key: "contractorlicensenumber", applies: i => washington(i) && /contract|construct|roof|plumb|electric|landscap|remodel|handyman|paint|floor|hvac|heat|cool|carpent|masonry|concrete|fenc|deck|excavat/i.test(i.category ?? "") },
];
export const LOCAL_REGISTRY_POLICIES: SourcePolicy[] = registries.map(r => ({
  id: r.id, origin: r.origin, paths: [`/resource/${r.dataset}.json`, `/api/views/${r.dataset}.json`],
  authority: "official_record", independenceGroup: r.origin, reviewedAt: "2026-10-14", expiresAt: "2027-04-14",
  permissionUrls: [`${r.origin}/api/views/${r.dataset}.json`, "https://dev.socrata.com/docs/queries/", "https://dev.socrata.com/docs/app-tokens.html", ...(r.license === "PDDL" ? ["https://opendatacommons.org/licenses/pddl/1-0/"] : [])],
  rights: { access: true, automate: true, extract: true, storeContent: true, retainFacts: true, commercialUse: true }, minIntervalMs: 1000, maxBytes: 200_000,
}));
// These datasets license business records, not linked sites, names of principals, or all city/state portal content.
const literal = (s: string) => "'" + s.replace(/'/g, "''") + "'";
export const localRegistryAdapters: SourceAdapter[] = registries.map((r, index) => ({
  id: r.id, minimumRequests: 4, priority: 5, applicable: r.applies, policy: LOCAL_REGISTRY_POLICIES[index]!, supplies: ["business_identity", "company_overview"],
  async discover(identity, fetcher) {
    if (!r.applies(identity)) return [];
    const policy = LOCAL_REGISTRY_POLICIES[index]!;
    const metadata = object(JSON.parse((await fetcher.get(`${r.origin}/api/views/${r.dataset}.json`, policy)).text));
    if (metadata.licenseId !== r.license || metadata.id !== r.dataset) throw new Error("dataset_license_or_identity_changed");
    const url = new URL(`/resource/${r.dataset}.json`, r.origin);
    // Exact names (including published DBA) find candidates; address/phone/branch matching still gates acceptance.
    const conditions = ["(" + r.names.map(n => `upper(${n})=${literal(identity.name.toUpperCase())}`).join(" OR ") + ")"];
    if (identity.city) conditions.push(`upper(city)=${literal(identity.city.toUpperCase())}`);
    if (identity.postalCode && /^\d{5}(?:-\d{4})?$/.test(identity.postalCode)) conditions.push(`zip like ${literal(identity.postalCode.slice(0,5) + "%")}`);
    conditions.push("upper(state)='WA'");
    url.searchParams.set("$where", conditions.join(" AND "));
    url.searchParams.set("$limit", String(RESEARCH_LIMITS.candidates));
    url.searchParams.set("$order", r.key + " ASC");
    const rows: unknown = JSON.parse((await fetcher.get(url.href, policy)).text);
    if (!Array.isArray(rows)) throw new Error("invalid_registry_search_response");
    return rows.slice(0, RESEARCH_LIMITS.candidates).flatMap(row => {
      const key = text(object(row)[r.key], 100);
      if (!key) return [];
      const record = new URL(url.origin + url.pathname);
      record.searchParams.set("$where", `${r.key}=${literal(key)}`);
      record.searchParams.set("$limit", "2");
      return [{ url: record.href, policyId: r.id, discoveredBy: r.id + "_exact_name", discoveredFrom: url.origin + url.pathname }];
    });
  },
}));
export function registryRecord(policyId: string, body: string, url?: string) {
  const registry = registries.find(r => r.id === policyId);
  if (!registry) return null;
  const rows: unknown = JSON.parse(body);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("registry_record_not_unique");
  const row = object(rows[0]);
  if (url && new URL(url).searchParams.get("$where") !== `${registry.key}=${literal(text(row[registry.key], 100))}`) throw new Error("registry_record_key_mismatch");
  const seattle = policyId.startsWith("seattle-");
  const identity: BusinessIdentity = {
    name: text(row[registry.names[0]!]), formerNames: seattle && text(row.trade_name) ? [text(row.trade_name)] : [],
    address: text(seattle ? row.street_address : [text(row.address1), text(row.address2)].filter(Boolean).join(" ")),
    city: text(row.city), state: text(row.state), postalCode: text(row.zip), country: "US", phone: text(seattle ? row.business_phone : row.phonenumber),
  };
  const facts: {category: ResearchFact["category"]; title: string; value: string}[] = [];
  const add = (label: string, value: unknown, category: ResearchFact["category"] = "business_identity") => {
    const v = text(value); if (v) facts.push({category, title: label, value: label + ": " + v});
  };
  add("Registry publisher", registry.publisher);
  add("Registered business name", identity.name, "company_overview");
  add("Registered address (not verified operating location)", [identity.address, identity.city, identity.state, identity.postalCode].filter(Boolean).join(", "));
  if (seattle) {
    add("Published trade name", row.trade_name, "company_overview");
    add("Seattle business license tax certificate account", row.city_account_number);
    add("Seattle active license dataset inclusion (not storefront verification)", "Listed at retrieval time");
    add("Registered industry classification (NAICS)", row.naics_description, "company_overview");
    add("License start date as published", row.license_start_date);
  } else {
    add("WA contractor license number", row.contractorlicensenumber);
    add("WA contractor license status as published", row.contractorlicensestatus);
    add("WA contractor license expiration as published", row.licenseexpirationdate);
    add("WA registered contractor specialty", row.specialtycode1desc, "company_overview");
    add("WA additional registered specialty", row.specialtycode2desc, "company_overview");
  }
  // Intentionally omit principal names and phone values from retained evidence.
  return { identity, facts };
}
