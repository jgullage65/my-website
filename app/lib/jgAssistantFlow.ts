export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v2";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "businessType" | "domain" | "promoWhat" | "goal" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  websiteType: "one_page" | "multi_page" | "store" | "not_sure" | null;
  designType: "flyer" | "social_pack" | "both" | "not_sure" | null;
  aiGoal: "faster_replies" | "better_marketing" | "reviews_followups" | "automating_tasks" | "not_sure" | null;
  aiWhere: "text_phone" | "email" | "social" | "website" | "not_sure" | null;
  aiSetupType: "basic" | "custom" | "not_sure" | null;
  businessType: string;
  domainHave: "yes" | "no" | "not_sure" | null;
  domainValue: string;
  promoWhat: string;
  promoAssets: "yes" | "no" | "some" | null;
  promoDeadline: "asap" | "few_days" | "next_week" | "no_rush" | null;
  goal: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep = "opening" | "service" | "website_type" | "domain_have" | "design_type" | "design_assets" | "design_deadline" | "ai_goal" | "ai_where" | "ai_setup" | "follow_up" | "handoff" | "learn_topics" | "learn_follow_up";
export type JGAssistantSession = { version: 2; intent: AssistantIntent; step: AssistantStep; expectedInput: ExpectedInput; activePathname: string; messages: AssistantMessage[]; answers: AssistantAnswers; lastLearnTopic: string | null };
export type AssistantOption = { id: string; label: string };
export type AssistantView = { options: AssistantOption[]; inputPlaceholder: string | null };

const emptyAnswers = (): AssistantAnswers => ({
  service: null, websiteType: null, designType: null, aiGoal: null, aiWhere: null, aiSetupType: null,
  businessType: "", domainHave: null, domainValue: "", promoWhat: "", promoAssets: null,
  promoDeadline: null, goal: "", followUp: null, email: "", phone: "",
});
const id = () => `jg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const assistant = (text: string): AssistantMessage => ({ id: id(), role: "assistant", text });
const user = (text: string): AssistantMessage => ({ id: id(), role: "user", text });
const routeName = (p: string) => p === "/" ? "Home" : p.startsWith("/services") ? "Services" : p.startsWith("/ai-tools") ? "AI Systems" : p.startsWith("/examples") ? "Portfolio" : p.startsWith("/about") ? "About" : p.startsWith("/contact") ? "Contact" : p.startsWith("/faq") ? "Quick Answers" : "JG Creative Studio";
const opening = (p: string) => p.startsWith("/services") ? "You’re looking at Services. I can help you decide what to build or explain which service fits your goal." : p.startsWith("/ai-tools") ? "You’re looking at AI Systems. I can explain what is possible or help shape a project request." : p.startsWith("/examples") ? "You’re looking at the portfolio. I can help you find the most relevant work or start a similar project." : p.startsWith("/contact") ? "You’re on Contact. I can organize what you need before you send the form." : "Hey, I’m the JG Assistant. I can help you start a project or answer questions about websites, AI systems, design, pricing, and process.";
const exchange = (s: JGAssistantSession, u: string, a: string, patch: Partial<JGAssistantSession>): JGAssistantSession => ({ ...s, ...patch, messages: [...s.messages, user(u), assistant(a)] });

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession {
  return { version: 2, intent: null, step: "opening", expectedInput: null, activePathname: pathname, messages: [assistant(opening(pathname))], answers: emptyAnswers(), lastLearnTopic: null };
}

export function parseStoredJGAssistantSession(raw: string | null, pathname: string): JGAssistantSession {
  if (!raw) return createInitialJGAssistantSession(pathname);
  try {
    const parsed = JSON.parse(raw) as Partial<JGAssistantSession>;
    if (parsed.version !== 2 || !Array.isArray(parsed.messages)) return createInitialJGAssistantSession(pathname);
    return { ...createInitialJGAssistantSession(pathname), ...parsed, activePathname: pathname, answers: { ...emptyAnswers(), ...(parsed.answers ?? {}) }, messages: parsed.messages.filter((m): m is AssistantMessage => !!m && typeof m.id === "string" && (m.role === "assistant" || m.role === "user") && typeof m.text === "string") };
  } catch { return createInitialJGAssistantSession(pathname); }
}

export function syncJGAssistantRoute(s: JGAssistantSession, pathname: string): JGAssistantSession {
  if (s.activePathname === pathname) return s;
  return { ...s, activePathname: pathname, messages: [...s.messages, assistant(`You’re now on ${routeName(pathname)}. I kept everything you already told me.`)] };
}

const learnOptions = (p: string): AssistantOption[] => p.startsWith("/ai-tools") ? [
  { id: "learn_ai_capabilities", label: "What can an AI system do?" }, { id: "learn_ai_process", label: "How does an AI project work?" }, { id: "learn_pricing", label: "How is pricing decided?" }, { id: "learn_timeline", label: "How long does it take?" },
] : [
  { id: "learn_service_fit", label: "Which service fits me?" }, { id: "learn_process", label: "How does the process work?" }, { id: "learn_timeline", label: "How long does a project take?" }, { id: "learn_pricing", label: "How is pricing decided?" }, { id: "learn_support", label: "Do you offer ongoing support?" },
];
const learnAnswer = (k: string) => ({
  learn_ai_capabilities: "AI systems can support replies, intake, follow-ups, internal workflows, content, lead handling, and website assistants.",
  learn_ai_process: "An AI project starts with the job the system needs to perform, then maps inputs, decisions, outputs, and handoffs before the build begins.",
  learn_process: "Projects move through scope, content and assets, build, review, and launch. I can organize the details before you contact James.",
  learn_timeline: "Timing depends on scope, content readiness, integrations, and testing. A real timeline is confirmed after the project details are reviewed.",
  learn_pricing: "Pricing is based on scope, complexity, content, integrations, and how custom the work needs to be.",
  learn_support: "Ongoing support can include updates, maintenance, content changes, and continued improvements after launch.",
  learn_service_fit: "A website fits credibility and conversion, design fits a promotion, and an AI system fits repeated work that should be faster or automated.",
}[k] ?? "I can explain that or help turn it into a project request.");

export function chooseJGAssistantOption(s: JGAssistantSession, optionId: string, label: string): JGAssistantSession {
  const a = { ...s.answers };
  if (optionId === "intent_buy" || optionId === "start_project") return exchange(s, label, "Great. What are you looking to build?", { intent: "buy", step: "service", expectedInput: null });
  if (optionId === "intent_learn" || optionId === "learn_another") return exchange(s, label, "What would you like to find out?", { intent: "learn", step: "learn_topics", expectedInput: null });
  if (optionId.startsWith("learn_")) return exchange(s, label, learnAnswer(optionId), { intent: "learn", step: "learn_follow_up", lastLearnTopic: optionId });
  if (optionId.startsWith("service_")) {
    a.service = optionId.replace("service_", "") as AssistantService;
    if (a.service === "website") return exchange(s, label, "What type of website are you thinking about?", { answers: a, step: "website_type" });
    if (a.service === "design") return exchange(s, label, "What kind of promotional design do you need?", { answers: a, step: "design_type" });
    if (a.service === "ai") return exchange(s, label, "What do you want the AI system to improve?", { answers: a, step: "ai_goal" });
    return exchange(s, label, "What type of business do you run?", { answers: a, expectedInput: "businessType" });
  }
  if (optionId.startsWith("website_")) { a.websiteType = optionId.replace("website_", "") as AssistantAnswers["websiteType"]; return exchange(s, label, "What type of business is the website for?", { answers: a, expectedInput: "businessType" }); }
  if (optionId.startsWith("domain_")) { a.domainHave = optionId.replace("domain_", "") as AssistantAnswers["domainHave"]; return exchange(s, label, a.domainHave === "yes" ? "What is the domain name?" : "What is the main goal of the website?", { answers: a, expectedInput: a.domainHave === "yes" ? "domain" : "goal" }); }
  if (optionId.startsWith("design_")) { a.designType = optionId.replace("design_", "") as AssistantAnswers["designType"]; return exchange(s, label, "What are you promoting?", { answers: a, expectedInput: "promoWhat" }); }
  if (optionId.startsWith("assets_")) { a.promoAssets = optionId.replace("assets_", "") as AssistantAnswers["promoAssets"]; return exchange(s, label, "When do you need it?", { answers: a, step: "design_deadline" }); }
  if (optionId.startsWith("deadline_")) { a.promoDeadline = optionId.replace("deadline_", "") as AssistantAnswers["promoDeadline"]; return exchange(s, label, "What is the main goal of the promotion?", { answers: a, expectedInput: "goal" }); }
  if (optionId.startsWith("aigoal_")) { a.aiGoal = optionId.replace("aigoal_", "") as AssistantAnswers["aiGoal"]; return exchange(s, label, "Where should the AI help happen?", { answers: a, step: "ai_where" }); }
  if (optionId.startsWith("aiwhere_")) { a.aiWhere = optionId.replace("aiwhere_", "") as AssistantAnswers["aiWhere"]; return exchange(s, label, "What level of setup are you looking for?", { answers: a, step: "ai_setup" }); }
  if (optionId.startsWith("aisetup_")) { a.aiSetupType = optionId.replace("aisetup_", "") as AssistantAnswers["aiSetupType"]; return exchange(s, label, "What type of business is this for?", { answers: a, expectedInput: "businessType" }); }
  if (optionId.startsWith("followup_")) { a.followUp = optionId.replace("followup_", "") as FollowUpMethod; return exchange(s, label, a.followUp === "email" ? "What is the best email to reach you?" : "What is the best phone number to text or call?", { answers: a, expectedInput: a.followUp === "email" ? "email" : "phone" }); }
  return s;
}

export function submitJGAssistantInput(s: JGAssistantSession, value: string): JGAssistantSession {
  const text = value.trim(); if (!text || !s.expectedInput) return s;
  const a = { ...s.answers };
  if (s.expectedInput === "businessType") { a.businessType = text; if (a.service === "website") return exchange(s, text, "Do you already have a domain name?", { answers: a, expectedInput: null, step: "domain_have" }); if (a.service === "design") return exchange(s, text, "Do you already have a logo, photos, or brand colors to use?", { answers: a, expectedInput: null, step: "design_assets" }); return exchange(s, text, "What is the biggest result you want from this project?", { answers: a, expectedInput: "goal" }); }
  if (s.expectedInput === "domain") { a.domainValue = text; return exchange(s, text, "What is the main goal of the website?", { answers: a, expectedInput: "goal" }); }
  if (s.expectedInput === "promoWhat") { a.promoWhat = text; return exchange(s, text, "What type of business is this for?", { answers: a, expectedInput: "businessType" }); }
  if (s.expectedInput === "goal") { a.goal = text; return exchange(s, text, "What is the best way to follow up with you?", { answers: a, expectedInput: null, step: "follow_up" }); }
  if (s.expectedInput === "email") a.email = text; else a.phone = text;
  return exchange(s, text, "Perfect. I saved everything you shared. You can open the project request or email James directly.", { answers: a, expectedInput: null, step: "handoff" });
}

export function buildJGAssistantView(s: JGAssistantSession): AssistantView {
  if (s.expectedInput) return { options: [], inputPlaceholder: ({ businessType: "Type your business type…", domain: "Type your domain…", promoWhat: "What are you promoting?", goal: "Describe the result you want…", email: "Type your email…", phone: "Type your phone number…" } as Record<Exclude<ExpectedInput, null>, string>)[s.expectedInput] };
  const map: Partial<Record<AssistantStep, AssistantOption[]>> = {
    opening: [{ id: "intent_buy", label: "I want to start a project" }, { id: "intent_learn", label: "I want to find something out" }],
    service: [{ id: "service_website", label: "Website" }, { id: "service_ai", label: "AI System" }, { id: "service_design", label: "Flyers / Social" }, { id: "service_not_sure", label: "Not sure yet" }],
    website_type: [{ id: "website_one_page", label: "One-page site" }, { id: "website_multi_page", label: "Multi-page business site" }, { id: "website_store", label: "Online store" }, { id: "website_not_sure", label: "Not sure yet" }],
    domain_have: [{ id: "domain_yes", label: "Yes" }, { id: "domain_no", label: "No" }, { id: "domain_not_sure", label: "Not sure" }],
    design_type: [{ id: "design_flyer", label: "Flyer / promo" }, { id: "design_social_pack", label: "Social media pack" }, { id: "design_both", label: "Both" }, { id: "design_not_sure", label: "Not sure yet" }],
    design_assets: [{ id: "assets_yes", label: "Yes" }, { id: "assets_some", label: "Some of it" }, { id: "assets_no", label: "No" }],
    design_deadline: [{ id: "deadline_asap", label: "ASAP" }, { id: "deadline_few_days", label: "Within a few days" }, { id: "deadline_next_week", label: "Next week" }, { id: "deadline_no_rush", label: "No rush" }],
    ai_goal: [{ id: "aigoal_faster_replies", label: "Faster customer replies" }, { id: "aigoal_reviews_followups", label: "Reviews / follow-ups" }, { id: "aigoal_automating_tasks", label: "Automate repeated tasks" }, { id: "aigoal_better_marketing", label: "Marketing / content" }, { id: "aigoal_not_sure", label: "Not sure yet" }],
    ai_where: [{ id: "aiwhere_website", label: "Website" }, { id: "aiwhere_email", label: "Email" }, { id: "aiwhere_text_phone", label: "Text / Phone" }, { id: "aiwhere_social", label: "Social media" }, { id: "aiwhere_not_sure", label: "Not sure yet" }],
    ai_setup: [{ id: "aisetup_basic", label: "Basic guided setup" }, { id: "aisetup_custom", label: "Custom automation" }, { id: "aisetup_not_sure", label: "Not sure yet" }],
    follow_up: [{ id: "followup_email", label: "Email" }, { id: "followup_phone", label: "Phone / Text" }],
    learn_follow_up: [{ id: "learn_another", label: "Ask about something else" }, { id: "start_project", label: "Start a project" }],
  };
  return { options: s.step === "learn_topics" ? learnOptions(s.activePathname) : map[s.step] ?? [], inputPlaceholder: null };
}

export function buildJGContactUrl(a: AssistantAnswers): string {
  const p = new URLSearchParams();
  p.set("service", a.service === "website" ? "Website Creation" : a.service === "design" ? "Flyer / Promo Design" : a.service === "ai" ? "AI Template Setup" : "Not sure yet");
  if (a.businessType) p.set("business_type", a.businessType); if (a.goal) p.set("goal", a.goal); if (a.followUp) p.set("preferred_contact", a.followUp); if (a.email) p.set("email", a.email); if (a.phone) p.set("phone", a.phone);
  return `/contact?${p.toString()}`;
}

export function buildJGDirectEmailUrl(a: AssistantAnswers): string {
  const subject = encodeURIComponent("New inquiry from JG Creative Studio website");
  const body = encodeURIComponent(`Hi James,\n\nService: ${a.service || "Not specified"}\nBusiness: ${a.businessType || "Not specified"}\nGoal: ${a.goal || "Not specified"}\nEmail: ${a.email || "Not provided"}\nPhone: ${a.phone || "Not provided"}`);
  return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
}
