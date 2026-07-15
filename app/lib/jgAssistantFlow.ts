export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v4";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "email" | "phone" | "freeform" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  websiteType: "one_page" | "multi_page" | "store" | "refresh" | "not_sure" | null;
  designType: "flyer" | "social_pack" | "both" | "not_sure" | null;
  aiGoal: "faster_replies" | "better_marketing" | "reviews_followups" | "automating_tasks" | "not_sure" | null;
  businessType: string;
  goal: string;
  currentWebsite: "yes" | "no" | "unsure" | null;
  budget: string;
  timeline: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep = "opening" | "learn_menu" | "service_menu" | "website_type" | "business_type" | "goal" | "ai_goal" | "design_type" | "recommendation" | "detail_menu" | "follow_up" | "handoff" | "advisor";
export type JGAssistantSession = { version: 4; intent: AssistantIntent; step: AssistantStep; expectedInput: ExpectedInput; activePathname: string; messages: AssistantMessage[]; answers: AssistantAnswers; lastLearnTopic: string | null };
export type AssistantOption = { id: string; label: string };
export type AssistantView = { options: AssistantOption[]; inputPlaceholder: string | null };

const emptyAnswers = (): AssistantAnswers => ({ service: null, websiteType: null, designType: null, aiGoal: null, businessType: "", goal: "", currentWebsite: null, budget: "", timeline: "", followUp: null, email: "", phone: "" });
const id = () => `jg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const assistant = (text: string): AssistantMessage => ({ id: id(), role: "assistant", text });
const user = (text: string): AssistantMessage => ({ id: id(), role: "user", text });
const exchange = (s: JGAssistantSession, u: string, a: string, patch: Partial<JGAssistantSession> = {}): JGAssistantSession => ({ ...s, ...patch, messages: [...s.messages, user(u), assistant(a)] });
const routeName = (p: string) => p === "/" ? "Home" : p.startsWith("/services") ? "Services" : p.startsWith("/pricing") ? "Pricing" : p.startsWith("/ai-tools") ? "AI Systems" : p.startsWith("/examples") ? "Portfolio" : p.startsWith("/contact") ? "Contact" : "JG Creative Studio";
const opening = (p: string) => p.startsWith("/pricing") ? "You’re on Pricing. I can compare packages or help choose the simplest fit." : p.startsWith("/services") ? "You’re looking at Services. I can help narrow down what fits your business." : p.startsWith("/ai-tools") ? "You’re looking at AI Systems. I can help identify a practical setup." : p.startsWith("/examples") ? "You’re looking at the portfolio. I can connect these examples to what makes sense for your business." : p.startsWith("/contact") ? "You’re on Contact. I can organize your project details before you send anything." : "Hey, I’m the JG Assistant. I can answer questions or help figure out what your business should build first.";
const has = (v: string, words: string[]) => words.some((w) => v.includes(w));
const remember = (a: AssistantAnswers, raw: string) => {
  const v = raw.toLowerCase();
  if (!a.businessType) {
    const m = v.match(/(?:i run|i own|my business is|for my|i have an?)\s+([a-z0-9 &'-]{3,45})/);
    if (m) a.businessType = m[1].replace(/[?.!,].*$/, "").trim();
  }
  if (has(v, ["already have a website", "have a website", "existing website", "current site"])) a.currentWebsite = "yes";
  if (has(v, ["no website", "don't have a website", "do not have a website", "from scratch"])) a.currentWebsite = "no";
  if (has(v, ["asap", "right away", "immediately"])) a.timeline = "ASAP";
  else if (has(v, ["next week", "within a week"])) a.timeline = "Within a week";
  else if (has(v, ["this month", "few weeks"])) a.timeline = "Within a month";
  const money = raw.match(/\$\s?\d+(?:,\d{3})*/);
  if (money) a.budget = money[0];
  return a;
};
const recommendation = (a: AssistantAnswers) => {
  const business = a.businessType ? ` for your ${a.businessType} business` : "";
  if (a.service === "design") return `I’d start with ${a.designType === "both" ? "a flyer and social pack" : a.designType === "social_pack" ? "a social media pack" : "a focused promo design"}${business}. Single designs start at $20+, and a three-design flyer pack starts at $49+.`;
  if (a.service === "ai") return `I’d start with the AI Starter Setup${business} unless you already know you need a multi-step automation. The starter begins at $39+, while advanced workflows begin at $149+ after scope is confirmed.`;
  if (a.currentWebsite === "yes" || a.websiteType === "refresh") return `A Website Refresh${business} is the best first move if the existing foundation is usable. It starts at $79+.`;
  if (a.websiteType === "one_page") return `A Starter Website${business} is the cleanest fit. It starts at $129+ and covers a modern one-page presence, calls to action, and contact capture.`;
  if (a.websiteType === "store") return `An online store needs a custom quote because products, payments, shipping, and inventory change the scope.`;
  return `A Business Website${business} is probably the best starting point. It begins at $249+ and covers the 3–5 page structure most businesses need, including mobile layout and lead capture.`;
};
const answerFreeform = (s: JGAssistantSession, raw: string) => {
  const v = raw.toLowerCase();
  const a = remember({ ...s.answers }, raw);
  if (has(v, ["how much", "price", "pricing", "cost", "budget"])) return exchange(s, raw, a.service === "design" ? "Design starts at $20+ for a single flyer or basic social pack. A three-design flyer pack starts at $49+." : a.service === "ai" ? "AI Starter Setup begins at $39+. Advanced automation begins at $149+." : "Website pricing starts at $79+ for a refresh, $129+ for a starter site, and $249+ for a business website.", { answers: a, step: "detail_menu", expectedInput: "freeform" });
  if (has(v, ["how long", "timeline", "take to build", "delivery"])) return exchange(s, raw, a.timeline ? `You mentioned ${a.timeline}. James can confirm whether that target fits once the scope is reviewed.` : "Simple design work and small website updates can move quickly when content is ready. Full websites and custom automations take longer because they need more review and testing.", { answers: a, step: "detail_menu", expectedInput: "freeform" });
  if (has(v, ["which service", "what do i need", "recommend", "best fit", "what should i"])) return exchange(s, raw, a.businessType || a.goal || a.service ? recommendation(a) : "I can narrow that down. Start by choosing the type of help you are considering.", { answers: a, step: a.businessType || a.goal || a.service ? "detail_menu" : "service_menu", expectedInput: "freeform" });
  if (has(v, ["process", "how does it work", "what happens next"])) return exchange(s, raw, "The process is: define the result, choose the simplest scope, collect content and assets, build, review, then launch or deliver.", { answers: a, step: "detail_menu", expectedInput: "freeform" });
  if (has(v, ["support", "maintenance", "after launch"])) return exchange(s, raw, "Ongoing support is available for updates, small fixes, content changes, and continued improvements. Website maintenance is listed at $79/month.", { answers: a, step: "detail_menu", expectedInput: "freeform" });
  if (has(v, ["ready", "contact", "start project", "get started", "quote"])) return exchange(s, raw, a.businessType || a.goal || a.service ? `I have enough to prepare a useful handoff. ${recommendation(a)} Choose how you want James to follow up.` : "I can prepare the handoff, but first choose the type of project you are considering.", { answers: a, step: a.businessType || a.goal || a.service ? "follow_up" : "service_menu", expectedInput: a.businessType || a.goal || a.service ? null : "freeform" });
  if (!a.businessType) return exchange(s, raw, "Got it. What type of business is this for?", { answers: a, step: "business_type", expectedInput: "freeform" });
  if (!a.goal) return exchange(s, raw, `I’ll remember that this is for a ${a.businessType} business. What is the main result you want?`, { answers: a, step: "goal", expectedInput: "freeform" });
  a.goal = a.goal || raw;
  return exchange(s, raw, `${recommendation(a)} Choose what you want to know next.`, { answers: a, step: "detail_menu", expectedInput: "freeform" });
};

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession { return { version: 4, intent: null, step: "opening", expectedInput: "freeform", activePathname: pathname, messages: [assistant(opening(pathname))], answers: emptyAnswers(), lastLearnTopic: null }; }
export function parseStoredJGAssistantSession(raw: string | null, pathname: string): JGAssistantSession { if (!raw) return createInitialJGAssistantSession(pathname); try { const p = JSON.parse(raw) as Partial<JGAssistantSession>; if (p.version !== 4 || !Array.isArray(p.messages)) return createInitialJGAssistantSession(pathname); return { ...createInitialJGAssistantSession(pathname), ...p, activePathname: pathname, answers: { ...emptyAnswers(), ...(p.answers ?? {}) }, messages: p.messages.filter((m): m is AssistantMessage => !!m && typeof m.id === "string" && (m.role === "assistant" || m.role === "user") && typeof m.text === "string") }; } catch { return createInitialJGAssistantSession(pathname); } }
export function syncJGAssistantRoute(s: JGAssistantSession, pathname: string): JGAssistantSession { if (s.activePathname === pathname) return s; return { ...s, activePathname: pathname, messages: [...s.messages, assistant(`You’re now on ${routeName(pathname)}. I kept everything you already told me.`)] }; }

export function chooseJGAssistantOption(s: JGAssistantSession, optionId: string, label: string): JGAssistantSession {
  const a = { ...s.answers };
  if (optionId === "intent_buy" || optionId === "start_project") return exchange(s, label, "What kind of project are you considering?", { intent: "buy", step: "service_menu", expectedInput: "freeform" });
  if (optionId === "intent_learn" || optionId === "learn_another") return exchange(s, label, "What would you like to learn about?", { intent: "learn", step: "learn_menu", expectedInput: "freeform" });
  if (optionId === "learn_pricing") return exchange(s, label, "Which type of pricing do you want to see?", { step: "service_menu", expectedInput: "freeform" });
  if (optionId === "learn_service_fit") return exchange(s, label, "Start by choosing the type of help you are considering.", { step: "service_menu", expectedInput: "freeform" });
  if (optionId === "learn_process") return exchange(s, label, "Projects move through scope, content and assets, build, review, and launch. What would you like to know next?", { step: "detail_menu", expectedInput: "freeform" });
  if (optionId === "learn_timeline") return exchange(s, label, "Timing depends on scope and how ready the content is. What type of project are you considering?", { step: "service_menu", expectedInput: "freeform" });
  if (optionId === "learn_support") return exchange(s, label, "Ongoing support can cover updates, maintenance, content changes, and continued improvements. What would you like to do next?", { step: "detail_menu", expectedInput: "freeform" });
  if (optionId.startsWith("service_")) { a.service = optionId.replace("service_", "") as AssistantService; if (a.service === "website") return exchange(s, label, "What type of website are you considering?", { answers: a, step: "website_type", expectedInput: "freeform" }); if (a.service === "design") return exchange(s, label, "What kind of design help do you need?", { answers: a, step: "design_type", expectedInput: "freeform" }); if (a.service === "ai") return exchange(s, label, "What do you want the AI setup to improve?", { answers: a, step: "ai_goal", expectedInput: "freeform" }); return exchange(s, label, "What type of business is this for?", { answers: a, step: "business_type", expectedInput: "freeform" }); }
  if (optionId.startsWith("website_")) { a.websiteType = optionId.replace("website_", "") as AssistantAnswers["websiteType"]; a.service = "website"; return exchange(s, label, "What type of business is the website for?", { answers: a, step: "business_type", expectedInput: "freeform" }); }
  if (optionId.startsWith("design_")) { a.designType = optionId.replace("design_", "") as AssistantAnswers["designType"]; a.service = "design"; return exchange(s, label, "What type of business is this for?", { answers: a, step: "business_type", expectedInput: "freeform" }); }
  if (optionId.startsWith("aigoal_")) { a.aiGoal = optionId.replace("aigoal_", "") as AssistantAnswers["aiGoal"]; a.service = "ai"; return exchange(s, label, "What type of business is this for?", { answers: a, step: "business_type", expectedInput: "freeform" }); }
  if (optionId.startsWith("business_")) { a.businessType = label; return exchange(s, label, "What is the biggest result you want from this project?", { answers: a, step: "goal", expectedInput: "freeform" }); }
  if (optionId.startsWith("goal_")) { a.goal = label; return exchange(s, label, `${recommendation(a)} Choose what you want to know next.`, { answers: a, step: "detail_menu", expectedInput: "freeform" }); }
  if (optionId === "detail_pricing") return answerFreeform(s, "How much does it cost?");
  if (optionId === "detail_timeline") return answerFreeform(s, "How long does it take?");
  if (optionId === "detail_process") return answerFreeform(s, "How does the process work?");
  if (optionId === "detail_support") return answerFreeform(s, "Do you offer ongoing support?");
  if (optionId.startsWith("followup_")) { a.followUp = optionId.replace("followup_", "") as FollowUpMethod; return exchange(s, label, a.followUp === "email" ? "What is the best email to reach you?" : "What is the best phone number to text or call?", { answers: a, expectedInput: a.followUp === "email" ? "email" : "phone" }); }
  if (optionId === "other_question") return exchange(s, label, "Go ahead and type your question below.", { step: "advisor", expectedInput: "freeform" });
  return answerFreeform(s, label);
}

export function submitJGAssistantInput(s: JGAssistantSession, value: string): JGAssistantSession {
  const text = value.trim(); if (!text) return s; const a = { ...s.answers };
  if (s.expectedInput === "email") { a.email = text; return exchange(s, text, "Perfect. I saved your project details and email.", { answers: a, expectedInput: "freeform", step: "handoff" }); }
  if (s.expectedInput === "phone") { a.phone = text; return exchange(s, text, "Perfect. I saved your project details and phone number.", { answers: a, expectedInput: "freeform", step: "handoff" }); }
  if (s.step === "business_type") { a.businessType = text; return exchange(s, text, "What is the biggest result you want from this project?", { answers: a, step: "goal", expectedInput: "freeform" }); }
  if (s.step === "goal") { a.goal = text; return exchange(s, text, `${recommendation(a)} Choose what you want to know next.`, { answers: a, step: "detail_menu", expectedInput: "freeform" }); }
  return answerFreeform(s, text);
}

export function buildJGAssistantView(s: JGAssistantSession): AssistantView {
  if (s.expectedInput === "email") return { options: [], inputPlaceholder: "Type your email…" };
  if (s.expectedInput === "phone") return { options: [], inputPlaceholder: "Type your phone number…" };
  const map: Partial<Record<AssistantStep, AssistantOption[]>> = {
    opening: [{ id: "intent_buy", label: "I want to start a project" }, { id: "intent_learn", label: "I want to find something out" }],
    learn_menu: [{ id: "learn_pricing", label: "Pricing & Packages" }, { id: "learn_service_fit", label: "Which Service Fits Me?" }, { id: "service_ai", label: "AI Systems" }, { id: "service_design", label: "Design Services" }, { id: "learn_process", label: "Process & Timeline" }, { id: "other_question", label: "Something Else" }],
    service_menu: [{ id: "service_website", label: "Website" }, { id: "service_design", label: "Flyers / Social" }, { id: "service_ai", label: "AI System" }, { id: "service_not_sure", label: "Not Sure Yet" }],
    website_type: [{ id: "website_one_page", label: "One-Page Website" }, { id: "website_multi_page", label: "Business Website" }, { id: "website_refresh", label: "Refresh Existing Website" }, { id: "website_store", label: "Online Store" }, { id: "website_not_sure", label: "Not Sure Yet" }],
    design_type: [{ id: "design_flyer", label: "Flyer / Promo" }, { id: "design_social_pack", label: "Social Media Pack" }, { id: "design_both", label: "Both" }, { id: "design_not_sure", label: "Not Sure Yet" }],
    ai_goal: [{ id: "aigoal_faster_replies", label: "Faster Customer Replies" }, { id: "aigoal_reviews_followups", label: "Reviews / Follow-Ups" }, { id: "aigoal_automating_tasks", label: "Automate Repeated Tasks" }, { id: "aigoal_better_marketing", label: "Marketing / Content" }, { id: "aigoal_not_sure", label: "Not Sure Yet" }],
    business_type: [{ id: "business_local", label: "Local Service Business" }, { id: "business_agency", label: "Agency / Professional Service" }, { id: "business_ecommerce", label: "E-Commerce" }, { id: "business_restaurant", label: "Restaurant / Food" }, { id: "business_personal", label: "Personal Brand" }, { id: "other_question", label: "Other" }],
    goal: [{ id: "goal_leads", label: "Get More Leads" }, { id: "goal_calls", label: "Get More Calls / Bookings" }, { id: "goal_credibility", label: "Build Trust / Credibility" }, { id: "goal_sales", label: "Sell Products Online" }, { id: "goal_time", label: "Save Time / Automate Work" }, { id: "other_question", label: "Something Else" }],
    detail_menu: [{ id: "detail_pricing", label: "Pricing" }, { id: "detail_timeline", label: "Typical Timeline" }, { id: "detail_process", label: "What’s Included / Process" }, { id: "detail_support", label: "Ongoing Support" }, { id: "start_project", label: "Start My Project" }, { id: "learn_another", label: "Ask About Something Else" }],
    follow_up: [{ id: "followup_email", label: "Email" }, { id: "followup_phone", label: "Phone / Text" }],
    advisor: [{ id: "learn_another", label: "Show Guided Options" }, { id: "start_project", label: "Start a Project" }],
  };
  return { options: map[s.step] ?? [], inputPlaceholder: "Or type your own question…" };
}

export function buildJGContactUrl(a: AssistantAnswers): string { const p = new URLSearchParams(); p.set("service", a.service === "website" ? "Website Creation" : a.service === "design" ? "Flyer / Promo Design" : a.service === "ai" ? "AI Template Setup" : "Not sure yet"); if (a.businessType) p.set("business_type", a.businessType); if (a.goal) p.set("goal", a.goal); if (a.followUp) p.set("preferred_contact", a.followUp); if (a.email) p.set("email", a.email); if (a.phone) p.set("phone", a.phone); p.set("notes_from_chatbot", `Budget: ${a.budget || "not provided"} | Timeline: ${a.timeline || "not provided"} | Recommendation: ${recommendation(a)}`); return `/contact?${p.toString()}`; }
export function buildJGDirectEmailUrl(a: AssistantAnswers): string { const subject = encodeURIComponent("New inquiry from JG Creative Studio website"); const body = encodeURIComponent(`Hi James,\n\nBusiness: ${a.businessType || "Not specified"}\nService: ${a.service || "Not specified"}\nGoal: ${a.goal || "Not specified"}\nBudget: ${a.budget || "Not specified"}\nTimeline: ${a.timeline || "Not specified"}\n\nSuggested starting point:\n${recommendation(a)}\n\nEmail: ${a.email || "Not provided"}\nPhone: ${a.phone || "Not provided"}`); return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`; }
