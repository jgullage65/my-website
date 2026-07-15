export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v12";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "custom_business" | "custom_project_need" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  businessType: string;
  projectNeed: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep =
  | "opening"
  | "learn_menu"
  | "learn_service_menu"
  | "learn_detail_menu"
  | "business_type"
  | "project_need"
  | "recommendation"
  | "follow_up"
  | "handoff";
export type JGAssistantSession = {
  version: 12;
  intent: AssistantIntent;
  step: AssistantStep;
  expectedInput: ExpectedInput;
  activePathname: string;
  messages: AssistantMessage[];
  answers: AssistantAnswers;
};
export type AssistantOption = { id: string; label: string };
export type AssistantView = { options: AssistantOption[]; inputPlaceholder: string | null };

type Recommendation = {
  service: Exclude<AssistantService, null>;
  title: string;
  reason: string;
  pricing: string;
  timeline: string;
  included: string;
};

const emptyAnswers = (): AssistantAnswers => ({
  service: null,
  businessType: "",
  projectNeed: "",
  followUp: null,
  email: "",
  phone: "",
});

const makeId = () => `jg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const assistant = (text: string): AssistantMessage => ({ id: makeId(), role: "assistant", text });
const user = (text: string): AssistantMessage => ({ id: makeId(), role: "user", text });

const exchange = (
  session: JGAssistantSession,
  userText: string,
  assistantText: string,
  patch: Partial<JGAssistantSession>,
): JGAssistantSession => ({
  ...session,
  ...patch,
  messages: [...session.messages, user(userText), assistant(assistantText)],
});

const openingText = (pathname: string) => {
  if (pathname.startsWith("/pricing")) return "I can explain pricing or guide you to the right project based on what your business needs.";
  if (pathname.startsWith("/services")) return "I can explain the services or recommend the best fit based on the problem you want to solve.";
  if (pathname.startsWith("/ai-tools")) return "I can explain the AI options or determine whether AI is actually the right solution for your business.";
  return "Hey, I’m the JG Assistant. I can help you learn about the services or recommend the right project for your business.";
};

const normalize = (value: string) => value.toLowerCase();

const resolveRecommendation = (answers: AssistantAnswers): Recommendation => {
  const need = normalize(answers.projectNeed);
  const business = answers.businessType || "business";

  const aiSignals = ["automate", "automation", "repetitive", "admin", "workflow", "save time", "support", "qualify", "organize", "connect tools"];
  const designSignals = ["flyer", "logo", "branding", "brand", "social", "graphic", "promotion", "event", "menu", "brochure", "visual"];
  const websiteSignals = ["website", "leads", "calls", "bookings", "credibility", "trust", "sell online", "ecommerce", "outdated", "online presence", "seo"];

  if (aiSignals.some((signal) => need.includes(signal))) {
    return {
      service: "ai",
      title: "AI Workflow System",
      reason: `You described a process problem for your ${business}, so the strongest fit is an AI workflow system rather than a website or design package. The goal is to remove repeated manual work and improve the exact workflow you identified.`,
      pricing: "AI starter setups currently begin at $39+. More advanced automations begin at $149+ after the workflow, tools, permissions, and integrations are confirmed.",
      timeline: "Simple setups can move quickly. Connected or multi-step automations take longer because each trigger, action, permission, and failure case must be tested.",
      included: "Workflow review, solution mapping, setup, testing, revisions, and a clear handoff for using the system.",
    };
  }

  if (designSignals.some((signal) => need.includes(signal))) {
    return {
      service: "design",
      title: "Focused Design Package",
      reason: `Your need is primarily visual and promotional, so a focused design package is the cleanest solution for your ${business}. A website or AI build would add scope without solving the immediate problem better.`,
      pricing: "Single designs begin at $20+, and a three-design flyer pack begins at $49+. Larger branding or multi-asset projects are scoped before work begins.",
      timeline: "Small design requests can usually move quickly. Larger coordinated sets require more asset preparation and review rounds.",
      included: "Goal and format review, brand asset collection, first draft, revisions, and final production-ready files.",
    };
  }

  if (websiteSignals.some((signal) => need.includes(signal))) {
    const refresh = need.includes("outdated") || need.includes("refresh") || need.includes("existing");
    return {
      service: "website",
      title: refresh ? "Website Refresh" : "Business Website",
      reason: refresh
        ? `You already have an online presence but described a trust or presentation problem. A website refresh is the most direct way to improve credibility and conversion without rebuilding more than necessary.`
        : `Your goal depends on people finding, trusting, and contacting your ${business}. A business website is the best foundation because it can support credibility, lead capture, calls, bookings, and future growth in one place.`,
      pricing: "Website refreshes begin at $79+, starter websites at $129+, and business websites at $249+. Final pricing depends on page count, content, and required features.",
      timeline: "A refresh can move quickly when content is ready. New websites take longer because they include structure, content placement, responsive testing, review, and launch.",
      included: "Scope, page structure, content and asset placement, responsive build, review, revisions, testing, and launch support.",
    };
  }

  return {
    service: "not_sure",
    title: "Project Review",
    reason: `Your need does not cleanly fit one package yet. The best recommendation is a short project review so James can identify whether the smallest effective solution is website, design, AI, or a combination without overselling you.`,
    pricing: "James will confirm the simplest suitable option before giving a starting price.",
    timeline: "Timing is confirmed once the actual scope and required assets are clear.",
    included: "Problem review, service recommendation, scope outline, starting price, and next-step plan.",
  };
};

const learnPricing = (service: AssistantService) => {
  if (service === "website") return "Website refreshes begin at $79+, starter websites at $129+, and business websites at $249+.";
  if (service === "design") return "Single designs begin at $20+, and a three-design flyer pack begins at $49+.";
  if (service === "ai") return "AI starter setups currently begin at $39+, while advanced automations begin at $149+ after scope is confirmed.";
  return "Pricing depends on the problem and the smallest service that can solve it properly.";
};

const learnProcess = (service: AssistantService) => {
  if (service === "website") return "Website projects cover scope, content and assets, page structure, build, review, mobile testing, and launch.";
  if (service === "design") return "Design projects cover the goal, required size and format, brand assets, first draft, revisions, and final delivery.";
  if (service === "ai") return "AI projects cover the current workflow, the task to improve, tools involved, proposed setup, testing, and handoff.";
  return "James first confirms the problem, then recommends the smallest service that can solve it properly.";
};

const learnTimeline = (service: AssistantService) => {
  if (service === "website") return "Refreshes can move quickly when content is ready. New websites take longer because they require structure, review, responsive testing, and launch work.";
  if (service === "design") return "Small design requests can usually move quickly. Larger coordinated sets require more review and asset preparation.";
  if (service === "ai") return "Simple AI setups can move quickly. Advanced automations take longer because tools, permissions, and failure cases must be tested.";
  return "Timing is confirmed after the problem and scope are clear.";
};

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession {
  return {
    version: 12,
    intent: null,
    step: "opening",
    expectedInput: null,
    activePathname: pathname,
    messages: [assistant(openingText(pathname))],
    answers: emptyAnswers(),
  };
}

export function parseStoredJGAssistantSession(raw: string | null, pathname: string): JGAssistantSession {
  if (!raw) return createInitialJGAssistantSession(pathname);
  try {
    const parsed = JSON.parse(raw) as Partial<JGAssistantSession>;
    if (parsed.version !== 12 || !Array.isArray(parsed.messages)) return createInitialJGAssistantSession(pathname);
    return {
      ...createInitialJGAssistantSession(pathname),
      ...parsed,
      activePathname: pathname,
      answers: { ...emptyAnswers(), ...(parsed.answers ?? {}) },
    };
  } catch {
    return createInitialJGAssistantSession(pathname);
  }
}

export function syncJGAssistantRoute(session: JGAssistantSession, pathname: string): JGAssistantSession {
  if (session.activePathname === pathname) return session;
  return { ...session, activePathname: pathname };
}

export function chooseJGAssistantOption(
  session: JGAssistantSession,
  optionId: string,
  label: string,
): JGAssistantSession {
  let answers = { ...session.answers };

  if (optionId === "intent_buy" || optionId === "learn_start_project") {
    answers = emptyAnswers();
    return exchange(session, label, "What type of business is this for?", {
      intent: "buy",
      step: "business_type",
      expectedInput: null,
      answers,
    });
  }

  if (optionId === "intent_learn" || optionId === "learn_back") {
    return exchange(session, label, "What would you like to learn about?", {
      intent: "learn",
      step: "learn_menu",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("learn_service_")) {
    answers.service = optionId.replace("learn_service_", "") as AssistantService;
    return exchange(session, label, "What would you like to know about this service?", {
      intent: "learn",
      step: "learn_detail_menu",
      expectedInput: null,
      answers,
    });
  }

  if (["learn_pricing", "learn_process", "learn_timeline"].includes(optionId)) {
    return exchange(session, label, "Choose the service you want information about.", {
      intent: "learn",
      step: "learn_service_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_support") {
    return exchange(session, label, "Ongoing support can cover updates, fixes, content changes, troubleshooting, and continued improvements after delivery.", {
      intent: "learn",
      step: "learn_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_detail_pricing") {
    return exchange(session, label, learnPricing(answers.service), { step: "learn_detail_menu", expectedInput: null });
  }
  if (optionId === "learn_detail_process") {
    return exchange(session, label, learnProcess(answers.service), { step: "learn_detail_menu", expectedInput: null });
  }
  if (optionId === "learn_detail_timeline") {
    return exchange(session, label, learnTimeline(answers.service), { step: "learn_detail_menu", expectedInput: null });
  }

  if (optionId.startsWith("business_")) {
    if (optionId === "business_other") {
      return exchange(session, label, "Type the business type below.", {
        step: "business_type",
        expectedInput: "custom_business",
      });
    }
    answers.businessType = label;
    return exchange(session, label, "What is the main problem you want this project to solve?", {
      answers,
      step: "project_need",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("need_")) {
    if (optionId === "need_other") {
      return exchange(session, label, "Describe the main problem or result you want below.", {
        step: "project_need",
        expectedInput: "custom_project_need",
      });
    }
    answers.projectNeed = label;
    const recommendation = resolveRecommendation(answers);
    answers.service = recommendation.service;
    return exchange(session, label, `${recommendation.title}\n\n${recommendation.reason}\n\nWould you like to review the recommendation or start the project?`, {
      answers,
      step: "recommendation",
      expectedInput: null,
    });
  }

  if (optionId === "recommend_price") {
    return exchange(session, label, resolveRecommendation(answers).pricing, { step: "recommendation", expectedInput: null });
  }
  if (optionId === "recommend_included") {
    return exchange(session, label, resolveRecommendation(answers).included, { step: "recommendation", expectedInput: null });
  }
  if (optionId === "recommend_timeline") {
    return exchange(session, label, resolveRecommendation(answers).timeline, { step: "recommendation", expectedInput: null });
  }
  if (optionId === "recommend_why") {
    return exchange(session, label, resolveRecommendation(answers).reason, { step: "recommendation", expectedInput: null });
  }
  if (optionId === "recommend_start") {
    return exchange(session, label, "How would you like James to reach you?", {
      step: "follow_up",
      expectedInput: null,
    });
  }
  if (optionId === "recommend_change") {
    answers.projectNeed = "";
    answers.service = null;
    return exchange(session, label, "What is the main problem you want this project to solve?", {
      answers,
      step: "project_need",
      expectedInput: null,
    });
  }

  if (optionId === "followup_email") {
    answers.followUp = "email";
    return exchange(session, label, "Enter your best email below.", {
      answers,
      step: "follow_up",
      expectedInput: "email",
    });
  }
  if (optionId === "followup_phone") {
    answers.followUp = "phone";
    return exchange(session, label, "Enter the best phone number to call or text below.", {
      answers,
      step: "follow_up",
      expectedInput: "phone",
    });
  }
  if (optionId === "project_not_ready") {
    return exchange(session, label, "No problem. Your recommendation is still here if you want to review it again.", {
      step: "recommendation",
      expectedInput: null,
    });
  }

  return exchange(session, label, "Choose one of the available next steps below.", {
    step: session.step,
    expectedInput: null,
  });
}

export function submitJGAssistantInput(session: JGAssistantSession, raw: string): JGAssistantSession {
  const value = raw.trim();
  const answers = { ...session.answers };

  if (session.expectedInput === "custom_business") {
    answers.businessType = value;
    return exchange(session, value, "What is the main problem you want this project to solve?", {
      answers,
      step: "project_need",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "custom_project_need") {
    answers.projectNeed = value;
    const recommendation = resolveRecommendation(answers);
    answers.service = recommendation.service;
    return exchange(session, value, `${recommendation.title}\n\n${recommendation.reason}\n\nWould you like to review the recommendation or start the project?`, {
      answers,
      step: "recommendation",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "email") {
    answers.email = value;
    return exchange(session, value, "Your project summary is ready. Use the button below to send the full request to James.", {
      answers,
      step: "handoff",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "phone") {
    answers.phone = value;
    return exchange(session, value, "Your project summary is ready. Use the button below to send the full request to James.", {
      answers,
      step: "handoff",
      expectedInput: null,
    });
  }

  return session;
}

export function buildJGAssistantView(session: JGAssistantSession): AssistantView {
  const optionMap: Record<AssistantStep, AssistantOption[]> = {
    opening: [
      { id: "intent_buy", label: "I Want to Start a Project" },
      { id: "intent_learn", label: "I Want to Find Something Out" },
    ],
    learn_menu: [
      { id: "learn_pricing", label: "Pricing & Packages" },
      { id: "learn_process", label: "Process & What’s Included" },
      { id: "learn_timeline", label: "Typical Timeline" },
      { id: "learn_support", label: "Ongoing Support" },
      { id: "learn_start_project", label: "Start My Project" },
    ],
    learn_service_menu: [
      { id: "learn_service_website", label: "Website" },
      { id: "learn_service_design", label: "Design Services" },
      { id: "learn_service_ai", label: "AI Systems" },
      { id: "learn_service_not_sure", label: "Not Sure Yet" },
      { id: "learn_back", label: "Back" },
    ],
    learn_detail_menu: [
      { id: "learn_detail_pricing", label: "Pricing" },
      { id: "learn_detail_process", label: "What’s Included / Process" },
      { id: "learn_detail_timeline", label: "Typical Timeline" },
      { id: "learn_start_project", label: "Start My Project" },
      { id: "learn_back", label: "Back to Information" },
    ],
    business_type: [
      { id: "business_local", label: "Local Service Business" },
      { id: "business_agency", label: "Agency / Professional Service" },
      { id: "business_ecommerce", label: "E-Commerce" },
      { id: "business_restaurant", label: "Restaurant / Food" },
      { id: "business_personal", label: "Personal Brand" },
      { id: "business_other", label: "Other" },
    ],
    project_need: [
      { id: "need_leads", label: "Get More Leads" },
      { id: "need_calls", label: "Get More Calls / Bookings" },
      { id: "need_credibility", label: "Improve Trust / Credibility" },
      { id: "need_outdated", label: "Fix an Outdated Website" },
      { id: "need_sales", label: "Sell Products Online" },
      { id: "need_design", label: "Create Flyers / Branding / Graphics" },
      { id: "need_automation", label: "Save Time / Automate Repetitive Work" },
      { id: "need_support", label: "Improve Customer Support" },
      { id: "need_other", label: "Something Else" },
    ],
    recommendation: [
      { id: "recommend_why", label: "Why This Recommendation?" },
      { id: "recommend_price", label: "Estimated Starting Price" },
      { id: "recommend_included", label: "What’s Included" },
      { id: "recommend_timeline", label: "Typical Timeline" },
      { id: "recommend_start", label: "Start My Project" },
      { id: "recommend_change", label: "Change My Need" },
    ],
    follow_up: session.expectedInput
      ? []
      : [
          { id: "followup_email", label: "Email" },
          { id: "followup_phone", label: "Phone / Text" },
          { id: "project_not_ready", label: "Not Ready Yet" },
        ],
    handoff: [],
  };

  const placeholders: Record<Exclude<ExpectedInput, null>, string> = {
    custom_business: "Type your business type",
    custom_project_need: "Describe the problem or result you want",
    email: "Enter your email",
    phone: "Enter your phone number",
  };

  return {
    options: optionMap[session.step],
    inputPlaceholder: session.expectedInput ? placeholders[session.expectedInput] : null,
  };
}

export function buildJGContactUrl(answers: AssistantAnswers): string {
  const params = new URLSearchParams();
  params.set("service", answers.service ?? "not_sure");
  if (answers.businessType) params.set("business_type", answers.businessType);
  if (answers.projectNeed) params.set("project_need", answers.projectNeed);
  if (answers.followUp) params.set("preferred_contact", answers.followUp);
  if (answers.email) params.set("email", answers.email);
  if (answers.phone) params.set("phone", answers.phone);
  const recommendation = resolveRecommendation(answers);
  params.set("notes_from_chatbot", `${recommendation.title}: ${recommendation.reason}`);
  return `/contact?${params.toString()}`;
}

export function buildJGDirectEmailUrl(answers: AssistantAnswers): string {
  const recommendation = resolveRecommendation(answers);
  const subject = encodeURIComponent(`New ${recommendation.title} inquiry from JG Creative Studio website`);
  const body = encodeURIComponent(
    `Hi James,\n\nBusiness: ${answers.businessType || "Not specified"}\nNeed: ${answers.projectNeed || "Not specified"}\nRecommended service: ${recommendation.title}\n\nWhy:\n${recommendation.reason}\n\nEmail: ${answers.email || "Not provided"}\nPhone: ${answers.phone || "Not provided"}`,
  );
  return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
}
