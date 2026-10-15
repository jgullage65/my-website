import { LOCAL_REGISTRY_POLICIES } from "./localRegistries";
import { type SourcePolicy } from "./contracts";

/** Only the API data is covered. GLEIF website text, logos and linked websites are not approved. */
export const GLEIF_POLICY: SourcePolicy = {
  id: "gleif-lei-cc0-2026-10",
  origin: "https://api.gleif.org",
  paths: ["/api/v1/lei-records"],
  authority: "official_record",
  independenceGroup: "gleif",
  reviewedAt: "2026-10-14",
  expiresAt: "2027-04-14",
  permissionUrls: [
    "https://www.gleif.org/en/about/open-data",
    "https://www.gleif.org/en/lei-data/gleif-api",
  ],
  rights: {
    access: true,
    automate: true,
    extract: true,
    storeContent: true,
    retainFacts: true,
    commercialUse: true,
  },
  minIntervalMs: 1500,
  maxBytes: 750_000,
};
export const SOURCE_POLICIES: readonly SourcePolicy[] = [GLEIF_POLICY, ...LOCAL_REGISTRY_POLICIES];
export function policyRejection(
  url: URL,
  policy: SourcePolicy | undefined,
  now = Date.now(),
  purpose: "retrieve" | "reuse" = "retrieve",
): string | null {
  if (!policy) return "unknown_source_permissions";
  if (policy.excluded) return "source_excluded";
  if (
    !Number.isFinite(Date.parse(policy.expiresAt)) ||
    now >= Date.parse(policy.expiresAt) ||
    !Number.isFinite(Date.parse(policy.reviewedAt)) ||
    Date.parse(policy.reviewedAt) > now
  )
    return "permission_review_expired";
  if (
    !policy.permissionUrls.length ||
    !(purpose === "retrieve" ? Object.values(policy.rights) : [policy.rights.storeContent, policy.rights.retainFacts, policy.rights.commercialUse]).every((v) => v === true) ||
    Object.keys(policy.rights).length !== 6
  )
    return "insufficient_access_or_reuse_rights";
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.origin !== policy.origin ||
    !policy.paths.some(
      (path) => url.pathname === path || url.pathname.startsWith(path + "/"),
    )
  )
    return "source_scope_rejected";
  if (/\/(?:login|signin|account|admin)(?:\/|$)/i.test(url.pathname))
    return "authentication_boundary";
  return null;
}

/** RFC 9309 longest matching group/rule, equal allow wins; unknown/unavailable robots fails closed. */
export function robotsDecision(
  body: string,
  url: URL,
  agent = "BusinessResearchBot",
): { allowed: boolean; delayMs: number } {
  type Group = {
    agents: string[];
    rules: { allow: boolean; path: string }[];
    delay: number;
  };
  const groups: Group[] = [];
  let current: Group | undefined;
  let hasRules = false;
  for (const raw of body.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.split("#")[0]!.trim(),
      colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase(),
      value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || hasRules) {
        current = { agents: [], rules: [], delay: 0 };
        groups.push(current);
        hasRules = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (current && ["allow", "disallow", "crawl-delay"].includes(key)) {
      hasRules = true;
      if (key === "crawl-delay" && /^\d+(?:\.\d+)?$/.test(value))
        current.delay = Math.max(current.delay, Number(value) * 1000);
      else if (value)
        current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const score = (group: Group) =>
    Math.max(
      -1,
      ...group.agents.map((a) =>
        a === "*" ? 0 : agent.toLowerCase().startsWith(a) ? a.length : -1,
      ),
    );
  const best = Math.max(-1, ...groups.map(score)),
    selected = groups.filter((g) => score(g) === best && best >= 0);
  const target = url.pathname + url.search;
  const normalized = (v: string) =>
    v.replace(/%[0-9a-f]{2}/gi, (e) => {
      const ch = String.fromCharCode(parseInt(e.slice(1), 16));
      return /[a-z0-9._~-]/i.test(ch) ? ch : e.toUpperCase();
    });
  const rules = selected
    .flatMap((g) => g.rules)
    .filter((r) => {
      const escaped = normalized(r.path)
        .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      return new RegExp("^" + escaped).test(normalized(target));
    })
    .sort(
      (a, b) =>
        b.path.replace(/[*$]/g, "").length -
          a.path.replace(/[*$]/g, "").length ||
        Number(b.allow) - Number(a.allow),
    );
  return {
    allowed: rules[0]?.allow ?? true,
    delayMs: Math.max(0, ...selected.map((g) => g.delay)),
  };
}
export function restrictedContent(
  headers: Headers,
  body: string,
): string | null {
  if (
    /\b(?:noarchive|nosnippet|noai|noimageai|none)\b/i.test(
      headers.get("x-robots-tag") ?? "",
    )
  )
    return "retention_directive";
  for (const tag of Array.from(body.matchAll(/<meta\b[^>]*>/gi))) {
    const name = tag[0].match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    const content =
      tag[0].match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    if (
      name &&
      /^(?:robots|BusinessResearchBot)$/i.test(name) &&
      /\b(?:noarchive|nosnippet|noai|none)\b/i.test(content)
    )
      return "retention_directive";
  }
  if (
    /captcha|cf-chl-|verify you are human|access denied|sign in to continue|login required|<input\b[^>]*type=["']password/i.test(
      body.slice(0, 100_000),
    )
  )
    return "access_barrier";
  return null;
}
