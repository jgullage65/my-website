export function classifyPage(url: string, title = "", existing = ""): string {
  if (existing && existing !== "page" && existing !== "other") return existing;
  const value = `${new URL(url).pathname} ${title}`.toLowerCase();
  const rules: Array<[RegExp,string]> = [[/faq|questions/,"faq"],[/pricing|plans/,"pricing"],[/services?/,"services"],[/products?|shop|store/,"products"],[/about|company|story/,"about"],[/polic|refund|return|shipping|terms/,"policies"],[/contact/,"contact"],[/locations?|areas?[- ]served/,"locations"],[/case[- ]stud|success|portfolio/,"case_studies"],[/testimonials?|reviews?/,"testimonials"],[/integrations?/,"integrations"],[/security|compliance|technical|developers?/,"technical"]];
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? (new URL(url).pathname === "/" ? "home" : "other");
}
