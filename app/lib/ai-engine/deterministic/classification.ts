import type { ClassifiedPageType, DeterministicPage } from "./contracts";
import { keyText } from "./util";
const RULES: Array<[
    ClassifiedPageType,
    RegExp
]> = [
    ["pricing", /\b(pric|plans?|packages?)\b/],
    ["faq", /\b(faq|questions?|help center)\b/],
    ["case_studies", /\b(case stud(?:y|ies)|success stor(?:y|ies)|customer stor(?:y|ies))\b/],
    ["testimonials", /\b(testimonials?|reviews?)\b/],
    ["security", /\b(security|trust center)\b/],
    ["compliance", /\b(compliance|privacy|gdpr|hipaa|soc 2)\b/],
    ["certifications", /\b(certif|accredit)\b/],
    ["integrations", /\b(integrations?|connectors?|apps?)\b/],
    ["locations", /\b(locations?|service areas?|find us)\b/],
    ["contact", /\b(contact|call us|email us)\b/],
    ["policies", /\b(policy|policies|terms|refund|cancel)\b/],
    ["onboarding", /\b(onboard|getting started|implementation)\b/],
    ["support", /\b(support|help desk)\b/],
    ["partnerships", /\b(partner|affiliate)\b/],
    ["industries", /\b(industries|sectors?)\b/],
    ["use_cases", /\b(use cases?|solutions? for)\b/],
    ["technical", /\b(technical|developers?|api|documentation)\b/],
    ["products", /\b(products?|platform)\b/],
    ["services", /\bservices?\b/],
    ["about", /\b(about|our story|company|mission)\b/]
];
export function classifyPage(page: Partial<DeterministicPage>, context = ""): ClassifiedPageType {
    const declared = keyText(page.pageType);
    const declaredAliases: Record<string, ClassifiedPageType> = { homepage: "home" };
    const recognized = new Set<ClassifiedPageType>(["home", "about", "products", "services", "pricing", "faq", "policies", "contact", "locations", "industries", "use_cases", "case_studies", "testimonials", "integrations", "security", "compliance", "technical", "onboarding", "support", "partnerships", "certifications", "other"]);
    const canonicalDeclared = (declaredAliases[declared] ?? declared) as ClassifiedPageType;
    // A crawler declaration is the canonical page type. Headings remain available
    // to extraction as context, but cannot turn (for example) a services page into pricing.
    if (recognized.has(canonicalDeclared) && canonicalDeclared !== "other")
        return canonicalDeclared;
    let path = "";
    try {
        path = new URL(page.url ?? "").pathname;
    }
    catch {
        path = page.url ?? "";
    }
    const signals = keyText(`${declared} ${path} ${page.title ?? ""} ${(page.headings ?? []).join(" ")} ${context}`);
    for (const [type, pattern] of RULES)
        if (pattern.test(signals))
            return type;
    return path === "/" || path === "" ? "home" : "other";
}
