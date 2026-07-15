export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v3";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "businessType" | "domain" | "promoWhat" | "goal" | "email" | "phone" | "freeform" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  websiteType: "one_page" | "multi_page" | "store" | "refresh" | "not_sure" | null;
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
  currentWebsite: "yes" | "no" | "unsure" | null;
  budget: string;
  timeline: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep = "opening" | "service" | "website_type" | "domain_have" | "design_type" | "design_assets" | "design_deadline" | "ai_goal" | "ai_where" | "ai_setup" | "follow_up" | "handoff" | "learn_topics" | "learn_follow_up" | "advisor";
export type JGAssistantSession = { version: 3; intent: AssistantIntent; step: AssistantStep; expectedInput: ExpectedInput; activePathname: string; messages: AssistantMessage[]; answers: AssistantAnswers; lastLearnTopic: string | null };
export type AssistantOption = { id: string; label: string };
export type AssistantView = { options: AssistantOption[]; inputPlaceholder: string | null };

const emptyAnswers = (): AssistantAnswers => ({
  service: null, websiteType: null, designType: null, aiGoal: null, aiWhere: null, aiSetupType: null,
  businessType: "", domainHave: null, domainValue: "", promoWhat: "", promoAssets: null,
  promoDeadline: null, goal: "", currentWebsite: null, budget: "", timeline: "", followUp: null,
  email: "", phone: "",
});
const makeId = () => `jg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const assistant = (text: string): AssistantMessage => ({ id: makeId(), role: "assistant", text });
const user = (text: string): AssistantMessage => ({ id: makeId(), role: "user", text });
const exchange = (s: JGAssistantSession, u: string, a: string, patch: Partial<JGAssistantSession> = {}): JGAssistantSession => ({ ...s, ...patch, messages: [...s.messages, user(u), assistant(a)] });
const routeName = (p: string) => p === "/" ? "Home" : p.startsWith("/services") ? "Services" : p.startsWith("/pricing") ? "Pricing" : p.startsWith("/ai-tools") ? "AI Systems" : p.startsWith("/examples") ? "Portfolio" : p.startsWith("/about") ? "About" : p.startsWith("/contact") ? "Contact" : p.startsWith("/faq") ? "Quick Answers" : "JG Creative Studio";
const opening = (p: string) => p.startsWith("/pricing") ? "You’re on Pricing. I can explain the options, compare packages, or help choose the simplest fit." : p.startsWith("/services") ? "You’re looking at Services. Tell me what your business needs and I’ll help narrow down the best fit." : p.startsWith("/ai-tools") ? "You’re looking at AI Systems. Tell me what keeps taking your time and I’ll help identify a practical setup." : p.startsWith("/examples") ? "You’re looking at the portfolio. I can help connect these examples to what would make sense for your business." : p.startsWith("/contact") ? "You’re on Contact. I can organize your project details before you send anything." : "Hey, I’m the JG Assistant. I can answer questions, compare options, or help figure out what your business should build first.";
const has = (v: string, words: string[]) => words.some((w) => v.includes(w));
const remember = (a: AssistantAnswers, raw: string) => {
  const v = raw.toLowerCase();
  if (!a.businessType) {
    const match = v.match(/(?:i run|i own|my business is|for my|i have an?)\s+([a-z0-9 &'-]{3,45})/);
    if (match) a.businessType = match[1].replace(/[?.!,].*$/, "").trim();
  }
  if (has(v, ["already have a website", "have a website", "existing website", "current site"])) a.currentWebsite = "yes";
  if (has(v, ["no website", "don't have a website", "do not have a website", "need a website from scratch"])) a.currentWebsite = "no";
  if (has(v, ["asap", "right away", "immediately"])) a.timeline = "ASAP";
  else if (has(v, ["next week", "within a week"])) a.timeline = "Within a week";
  else if (has(v, ["this month", "few weeks"])) a.timeline = "Within a month";
  const money = raw.match(/\$\s?\d+(?:,\d{3})*/);
  if (money) a.budget = money[0];
  return a;
};
const serviceLabel = (s: AssistantService) => s === "website" ? "website" : s === "design" ? "design package" : s === "ai" ? "AI setup" : "project";
const recommendation = (a: AssistantAnswers) => {
  const business = a.businessType ? ` for your ${a.businessType} business` : "";
  if (a.currentWebsite === "yes" && (a.goal.toLowerCase().includes("update") || a.goal.toLowerCase().includes("better"))) return `Based on what you’ve shared, I’d start with a Website Refresh${business}. It starts at $79+ and makes more sense than rebuilding everything if the foundation is usable.`;
  if (a.service === "design") return `I’d start with ${a.designType === "both" ? "a flyer and social pack" : a.designType === "social_pack" ? "a social media pack" : "a focused promo design"}${business}. Single designs start at $20+, and a three-design flyer pack starts at $49+.`;
  if (a.service === "ai") return `I’d start with the AI Starter Setup${business} unless you already know you need a multi-step automation. The starter begins at $39+; advanced workflows begin at $149+ after scope is confirmed.`;
  if (a.websiteType === "one_page") return `A Starter Website${business} is the cleanest fit. It starts at $129+ and covers a modern one-page presence, calls to action, and contact capture.`;
  if (a.websiteType === "store") return `An online store needs a custom quote because products, payments, shipping, and inventory change the scope. I’d define those pieces before recommending a package.`;
  return `A Business Website${business} is probably the best starting point. It begins at $249+ and covers the 3–5 page structure most real businesses need, including mobile layout and lead capture.`;
};
const answerFreeform = (s: JGAssistantSession, raw: string) => {
  const v = raw.toLowerCase();
  const a = remember({ ...s.answers }, raw);
  if (has(v, ["how much", "price", "pricing", "cost", "budget"])) return exchange(s, raw, a.service === "website" ? "Website starting prices are $79+ for a refresh, $129+ for a starter one-page site, and $249+ for the most popular business website. The exact quote depends on content, pages, and special features." : a.service === "design" ? "Design starts at $20+ for a single flyer or basic social pack. A three-design flyer pack starts at $49+, and ten basic social posts start at $35+." : a.service === "ai" ? "AI Starter Setup begins at $39+. Advanced multi-step automation begins at $149+ after the workflow is defined." : "Starting prices are $20+ for design, $79+ for website refreshes, $129+ for starter websites, $249+ for business websites, $39+ for AI starter setups, and $149+ for advanced automation.", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["how long", "timeline", "take to build", "delivery"])) return exchange(s, raw, a.timeline ? `You mentioned ${a.timeline}. The exact timeline still depends on content readiness and scope, but I’d use that as the target when James reviews the project.` : "Simple design work and small website updates can move quickly when the content is ready. Full websites and custom automations take longer because they need more review and testing. What deadline are you working toward?", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["which service", "what do i need", "recommend", "best fit", "what should i"] )) return exchange(s, raw, a.businessType || a.goal || a.service ? recommendation(a) : "I can narrow that down. What type of business is this, and what is the main result you want: more calls, more bookings, better promotion, faster replies, or less repeated work?", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["process", "how does it work", "what happens next"])) return exchange(s, raw, "The process is: define the result, choose the simplest scope, collect content and assets, build, review, then launch or deliver. I’ll keep organizing the details as you answer so the handoff is clear.", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["support", "maintenance", "after launch"])) return exchange(s, raw, "Ongoing support is available for updates, small fixes, content changes, and continued improvements. Website maintenance is listed at $79/month with no long-term commitment.", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["facebook", "instagram", "social media"])) return exchange(s, raw, "Yes. Design packages can be sized for Facebook and Instagram, and AI or workflow projects can also support social reply and content processes depending on what you want handled.", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["already have a website", "current website", "existing site"])) return exchange(s, raw, "That changes the recommendation. If the site works but looks dated or needs cleanup, a Website Refresh starting at $79+ may be enough. If the structure is holding the business back, a rebuild makes more sense. What is the biggest problem with the current site?", { answers: { ...a, currentWebsite: "yes" }, step: "advisor", expectedInput: "freeform" });
  if (has(v, ["ready", "contact", "start project", "get started", "quote"])) return exchange(s, raw, a.businessType || a.goal || a.service ? `I have enough to prepare a useful handoff. ${recommendation(a)} Choose how you want James to follow up.` : "I can prepare the handoff, but first tell me what type of business this is and what you want the project to accomplish.", { answers: a, step: a.businessType || a.goal || a.service ? "follow_up" : "advisor", expectedInput: a.businessType || a.goal || a.service ? null : "freeform" });
  if (!a.businessType) return exchange(s, raw, "Got it. What type of business is this for? That will help me give you a useful recommendation instead of a generic answer.", { answers: a, step: "advisor", expectedInput: "freeform" });
  if (!a.goal) return exchange(s, raw, `I’ll remember that this is for a ${a.businessType} business. What is the main result you want from the project?`, { answers: a, step: "advisor", expectedInput: "freeform" });
  return exchange(s, raw, `${recommendation(a)} You can ask about price, timeline, what is included, or tell me more about the result you want.`, { answers: a, step: "advisor", expectedInput: "freeform" });
};

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession { return { version: 3, intent: null, step: "opening", expectedInput: "freeform", activePathname: pathname, messages: [assistant(opening(pathname))], answers: emptyAnswers(), lastLearnTopic: null }; }
export function parseStoredJGAssistantSession(raw: string | null, pathname: string): JGAssistantSession { if (!raw) return createInitialJGAssistantSession(pathname); try { const p = JSON.parse(raw) as Partial<JGAssistantSession>; if (p.version !== 3 || !Array.isArray(p.messages)) return createInitialJGAssistantSession(pathname); return { ...createInitialJGAssistantSession(pathname), ...p, activePathname: pathname, expectedInput: p.expectedInput ?? "freeform", answers: { ...emptyAnswers(), ...(p.answers ?? {}) }, messages: p.messages.filter((m): m is AssistantMessage => !!m && typeof m.id === "string" && (m.role === "assistant" || m.role === "user") && typeof m.text === "string") }; } catch { return createInitialJGAssistantSession(pathname); } }
export function syncJGAssistantRoute(s: JGAssistantSession, pathname: string): JGAssistantSession { if (s.activePathname === pathname) return s; return { ...s, activePathname: pathname, messages: [...s.messages, assistant(`You’re now on ${routeName(pathname)}. I kept everything you already told me, so we can continue without starting over.`)] }; }

export function chooseJGAssistantOption(s: JGAssistantSession, optionId: string, label: string): JGAssistantSession {
  const a = { ...s.answers };
  if (optionId === "intent_buy" || optionId === "start_project") return exchange(s, label, "Tell me what type of business this is and the main result you want. I’ll help narrow down the simplest fit.", { intent: "buy", step: "advisor", expectedInput: "freeform" });
  if (optionId === "intent_learn" || optionId === "learn_another") return exchange(s, label, "Ask me about services, pricing, timing, process, support, or what would fit your business.", { intent: "learn", step: "advisor", expectedInput: "freeform" });
  if (optionId.startsWith("service_")) { a.service = optionId.replace("service_", "") as AssistantService; return exchange(s, label, `Good starting point. What type of business is the ${serviceLabel(a.service)} for, and what should it accomplish?`, { answers: a, step: "advisor", expectedInput: "freeform" }); }
  if (optionId.startsWith("website_")) { a.websiteType = optionId.replace("website_", "") as AssistantAnswers["websiteType"]; a.service = "website"; return exchange(s, label, "What type of business is it for, and what is the main goal of the site?", { answers: a, step: "advisor", expectedInput: "freeform" }); }
  if (optionId.startsWith("design_")) { a.designType = optionId.replace("design_", "") as AssistantAnswers["designType"]; a.service = "design"; return exchange(s, label, "What are you promoting, and when do you need it?", { answers: a, step: "advisor", expectedInput: "freeform" }); }
  if (optionId.startsWith("aigoal_")) { a.aiGoal = optionId.replace("aigoal_", "") as AssistantAnswers["aiGoal"]; a.service = "ai"; return exchange(s, label, "What type of business is this for, and where does that repeated work happen now?", { answers: a, step: "advisor", expectedInput: "freeform" }); }
  if (optionId.startsWith("followup_")) { a.followUp = optionId.replace("followup_", "") as FollowUpMethod; return exchange(s, label, a.followUp === "email" ? "What is the best email to reach you?" : "What is the best phone number to text or call?", { answers: a, expectedInput: a.followUp === "email" ? "email" : "phone" }); }
  return answerFreeform(s, label);
}

export function submitJGAssistantInput(s: JGAssistantSession, value: string): JGAssistantSession {
  const text = value.trim(); if (!text) return s; const a = { ...s.answers };
  if (s.expectedInput === "email") { a.email = text; return exchange(s, text, "Perfect. I saved your project details and email. You can open the project request or email James directly.", { answers: a, expectedInput: "freeform", step: "handoff" }); }
  if (s.expectedInput === "phone") { a.phone = text; return exchange(s, text, "Perfect. I saved your project details and phone number. You can open the project request or email James directly.", { answers: a, expectedInput: "freeform", step: "handoff" }); }
  return answerFreeform(s, text);
}

export function buildJGAssistantView(s: JGAssistantSession): AssistantView {
  if (s.expectedInput === "email") return { options: [], inputPlaceholder: "Type your email…" };
  if (s.expectedInput === "phone") return { options: [], inputPlaceholder: "Type your phone number…" };
  const options: AssistantOption[] = s.step === "opening" ? [{ id: "intent_buy", label: "I want to start a project" }, { id: "intent_learn", label: "I want to find something out" }] : s.step === "follow_up" ? [{ id: "followup_email", label: "Email" }, { id: "followup_phone", label: "Phone / Text" }] : s.step === "handoff" ? [] : [{ id: "start_project", label: "Start a project" }];
  return { options, inputPlaceholder: "Ask a question or describe what you need…" };
}

export function buildJGContactUrl(a: AssistantAnswers): string {
  const p = new URLSearchParams(); p.set("service", a.service === "website" ? "Website Creation" : a.service === "design" ? "Flyer / Promo Design" : a.service === "ai" ? "AI Template Setup" : "Not sure yet");
  if (a.businessType) p.set("business_type", a.businessType); if (a.goal) p.set("goal", a.goal); if (a.followUp) p.set("preferred_contact", a.followUp); if (a.email) p.set("email", a.email); if (a.phone) p.set("phone", a.phone);
  const notes = [`Current website: ${a.currentWebsite ?? "unknown"}`, `Budget: ${a.budget || "not provided"}`, `Timeline: ${a.timeline || "not provided"}`, `Recommendation: ${recommendation(a)}`]; p.set("notes_from_chatbot", notes.join(" | "));
  return `/contact?${p.toString()}`;
}
export function buildJGDirectEmailUrl(a: AssistantAnswers): string { const subject = encodeURIComponent("New inquiry from JG Creative Studio website"); const body = encodeURIComponent(`Hi James,\n\nBusiness: ${a.businessType || "Not specified"}\nService: ${a.service || "Not specified"}\nGoal: ${a.goal || "Not specified"}\nCurrent website: ${a.currentWebsite || "Not specified"}\nBudget: ${a.budget || "Not specified"}\nTimeline: ${a.timeline || "Not specified"}\n\nSuggested starting point:\n${recommendation(a)}\n\nEmail: ${a.email || "Not provided"}\nPhone: ${a.phone || "Not provided"}`); return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`; }
