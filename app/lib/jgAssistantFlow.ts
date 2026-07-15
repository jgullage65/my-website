export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v13";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "custom_business" | "custom_goal" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };

export type AssistantAnswers = {
  service: AssistantService;
  businessType: string;
  goal: string;
  currentSituation: string;
  frustration: string;
  budget: string;
  timeline: string;
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
  | "goal"
  | "current_situation"
  | "frustration"
  | "budget"
  | "timeline"
  | "recommendation"
  | "follow_up"
  | "handoff";

export type JGAssistantSession = {
  version: 13;
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
  summary: string;
  why: string;
  pricing: string;
  timeline: string;
  included: string;
};

type ScoreCard = Record<"website" | "design" | "ai", number>;

const emptyAnswers = (): AssistantAnswers => ({
  service: null,
  businessType: "",
  goal: "",
  currentSituation: "",
  frustration: "",
  budget: "",
  timeline: "",
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
  if (pathname.startsWith("/pricing")) {
    return "I can explain pricing or guide you to the right project based on what your business actually needs.";
  }
  if (pathname.startsWith("/services")) {
    return "I can explain the services or recommend the best fit after learning a little about your business.";
  }
  if (pathname.startsWith("/ai-tools")) {
    return "I can explain the AI options or help determine whether AI is truly the right solution for your business.";
  }
  return "Hey, I’m the JG Assistant. I can help you learn about the services or guide you through the right project for your business.";
};

const normalize = (value: string) => value.trim().toLowerCase();
const includesAny = (value: string, signals: string[]) => signals.some((signal) => value.includes(signal));

const add = (scores: ScoreCard, service: keyof ScoreCard, amount: number) => {
  scores[service] += amount;
};

const scoreAnswers = (answers: AssistantAnswers): ScoreCard => {
  const scores: ScoreCard = { website: 0, design: 0, ai: 0 };
  const goal = normalize(answers.goal);
  const situation = normalize(answers.currentSituation);
  const frustration = normalize(answers.frustration);
  const budget = normalize(answers.budget);
  const timeline = normalize(answers.timeline);

  if (includesAny(goal, ["lead", "call", "booking", "credibility", "trust", "online", "website", "sell", "e-commerce", "ecommerce"])) {
    add(scores, "website", 4);
  }
  if (includesAny(goal, ["brand", "branding", "flyer", "graphic", "social", "visual", "promotion", "logo"])) {
    add(scores, "design", 4);
  }
  if (includesAny(goal, ["automate", "automation", "save time", "workflow", "repetitive", "support", "organize", "connect tools", "qualify"])) {
    add(scores, "ai", 4);
  }

  if (situation.includes("starting from scratch")) add(scores, "website", 3);
  if (situation.includes("website is outdated")) add(scores, "website", 5);
  if (situation.includes("good website")) {
    add(scores, "design", 1);
    add(scores, "ai", 1);
  }
  if (situation.includes("use some ai")) add(scores, "ai", 3);
  if (situation.includes("just exploring")) {
    add(scores, "website", 1);
    add(scores, "design", 1);
    add(scores, "ai", 1);
  }

  if (frustration.includes("losing leads")) add(scores, "website", 4);
  if (frustration.includes("manual work")) add(scores, "ai", 5);
  if (frustration.includes("website looks outdated")) add(scores, "website", 5);
  if (frustration.includes("better branding")) add(scores, "design", 5);
  if (frustration.includes("several things")) {
    add(scores, "website", 2);
    add(scores, "design", 2);
    add(scores, "ai", 2);
  }

  if (budget.includes("under $500")) {
    add(scores, "design", 1);
    add(scores, "website", 1);
    add(scores, "ai", 1);
  }
  if (budget.includes("$500 to $1,500") || budget.includes("$1,500 to $5,000") || budget.includes("$5,000+")) {
    add(scores, "website", 1);
    add(scores, "ai", 1);
  }

  if (timeline.includes("as soon as possible")) {
    add(scores, "design", 1);
    add(scores, "website", 1);
  }

  return scores;
};

const recommendationCopy = (
  service: Exclude<AssistantService, null>,
  answers: AssistantAnswers,
): Recommendation => {
  const business = answers.businessType || "business";
  const goal = answers.goal || "your main goal";
  const frustration = answers.frustration || "the current problem";
  const situation = answers.currentSituation || "your current setup";

  if (service === "ai") {
    return {
      service,
      title: "AI Workflow System",
      summary: `For your ${business}, the strongest fit is an AI Workflow System. You want to ${goal.toLowerCase()}, and your biggest frustration is ${frustration.toLowerCase()}. This recommendation focuses on removing repeated work instead of adding another tool you still have to manage manually.`,
      why: `AI ranks above a website or design package here because your answers point to an operational problem, not primarily a visibility or branding problem. With ${situation.toLowerCase()}, the highest-value move is improving the workflow itself so the same work takes less time and fewer manual steps.`,
      pricing: "AI starter setups currently begin at $39+. More advanced automations begin at $149+ after the workflow, tools, permissions, and integrations are confirmed.",
      timeline: "Simple setups can move quickly. Connected or multi-step automations take longer because each trigger, action, permission, and failure case must be tested.",
      included: "Workflow review, solution mapping, setup, integration configuration, testing, revisions, and a clear handoff for using the system.",
    };
  }

  if (service === "design") {
    return {
      service,
      title: "Focused Design Package",
      summary: `For your ${business}, the strongest fit is a Focused Design Package. You want to ${goal.toLowerCase()}, and ${frustration.toLowerCase()} is the clearest issue to solve first. This gives you the visual assets you need without forcing a larger website or AI project.` ,
      why: `Design ranks above the alternatives because the problem you described is mainly visual, promotional, or brand-related. A website build would add unnecessary scope, while automation would not directly improve how the business is presented to customers.`,
      pricing: "Single designs begin at $20+, and a three-design flyer pack begins at $49+. Larger branding or multi-asset projects are scoped before work begins.",
      timeline: "Small design requests can usually move quickly. Larger coordinated sets require more asset preparation and review rounds.",
      included: "Goal and format review, brand asset collection, first draft, revisions, and final production-ready files.",
    };
  }

  if (service === "website") {
    const refresh = normalize(answers.currentSituation).includes("outdated") || normalize(answers.frustration).includes("outdated");
    return {
      service,
      title: refresh ? "Website Refresh" : "Business Website",
      summary: refresh
        ? `For your ${business}, the strongest fit is a Website Refresh. Your current website is getting in the way of ${goal.toLowerCase()}, so the priority is improving trust, clarity, and conversion without rebuilding more than necessary.`
        : `For your ${business}, the strongest fit is a Business Website. You want to ${goal.toLowerCase()}, and your answers show that customers need a clearer place to find, trust, and contact the business.`,
      why: refresh
        ? "A refresh ranks above design-only work because the problem lives inside the customer journey, not just in a single visual asset. It also ranks above AI because the immediate gap is credibility and conversion, not internal workflow efficiency."
        : `A website ranks above the alternatives because your answers point to visibility, trust, lead capture, calls, bookings, or online sales. It creates the foundation those goals depend on, while design or AI alone would only solve part of the problem.`,
      pricing: "Website refreshes begin at $79+, starter websites at $129+, and business websites at $249+. Final pricing depends on page count, content, and required features.",
      timeline: "A refresh can move quickly when content is ready. New websites take longer because they include structure, content placement, responsive testing, review, and launch.",
      included: "Scope, page structure, content and asset placement, responsive build, review, revisions, testing, and launch support.",
    };
  }

  return {
    service: "not_sure",
    title: "Project Review",
    summary: `Your answers point to more than one possible solution for your ${business}. A short Project Review is the safest recommendation so James can confirm the smallest effective scope without forcing you into the wrong service.`,
    why: "The scoring is too close or the need is still unclear. Recommending a website, design package, or AI system now would be guessing. A project review keeps the next step specific while avoiding an oversized or mismatched project.",
    pricing: "James will confirm the simplest suitable option before giving a starting price.",
    timeline: "Timing is confirmed once the actual scope and required assets are clear.",
    included: "Problem review, service recommendation, scope outline, starting price, and next-step plan.",
  };
};

const resolveRecommendation = (answers: AssistantAnswers): Recommendation => {
  const scores = scoreAnswers(answers);
  const ranked = (Object.entries(scores) as [keyof ScoreCard, number][]).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  const unclear =
    normalize(answers.goal).includes("not sure") ||
    normalize(answers.frustration).includes("not sure") ||
    normalize(answers.currentSituation).includes("just exploring");

  if (first[1] < 4 || first[1] - second[1] < 2 || unclear) {
    return recommendationCopy("not_sure", answers);
  }

  return recommendationCopy(first[0], answers);
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

const startProject = (session: JGAssistantSession, label: string): JGAssistantSession => {
  return exchange(session, label, "What type of business is this for?", {
    intent: "buy",
    step: "business_type",
    expectedInput: null,
    answers: emptyAnswers(),
  });
};

const finishQualification = (
  session: JGAssistantSession,
  label: string,
  answers: AssistantAnswers,
): JGAssistantSession => {
  const recommendation = resolveRecommendation(answers);
  answers.service = recommendation.service;
  return exchange(session, label, `${recommendation.title}\n\n${recommendation.summary}`, {
    answers,
    step: "recommendation",
    expectedInput: null,
  });
};

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession {
  return {
    version: 13,
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
    if (parsed.version !== 13 || !Array.isArray(parsed.messages)) {
      return createInitialJGAssistantSession(pathname);
    }
    return {
      ...createInitialJGAssistantSession(pathname),
      ...parsed,
      version: 13,
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
  const answers = { ...session.answers };

  if (optionId === "intent_buy" || optionId === "learn_start_project" || optionId === "learn_fit") {
    return startProject(session, label);
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
    return exchange(
      session,
      label,
      "Ongoing support can cover updates, fixes, content changes, troubleshooting, and continued improvements after delivery.",
      { intent: "learn", step: "learn_menu", expectedInput: null },
    );
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
        intent: "buy",
        step: "business_type",
        expectedInput: "custom_business",
      });
    }
    answers.businessType = label;
    return exchange(session, label, "What is the primary goal for this project?", {
      intent: "buy",
      answers,
      step: "goal",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("goal_")) {
    if (optionId === "goal_other") {
      return exchange(session, label, "Describe the main result you want below.", {
        intent: "buy",
        step: "goal",
        expectedInput: "custom_goal",
      });
    }
    answers.goal = label;
    return exchange(session, label, "Which best describes your current situation?", {
      answers,
      step: "current_situation",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("situation_")) {
    answers.currentSituation = label;
    return exchange(session, label, "What is your biggest frustration right now?", {
      answers,
      step: "frustration",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("frustration_")) {
    answers.frustration = label;
    return exchange(session, label, "What budget range are you considering?", {
      answers,
      step: "budget",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("budget_")) {
    answers.budget = label;
    return exchange(session, label, "When are you hoping to move forward?", {
      answers,
      step: "timeline",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("timeline_")) {
    answers.timeline = label;
    return finishQualification(session, label, answers);
  }

  if (optionId === "recommend_price") {
    return exchange(session, label, resolveRecommendation(answers).pricing, {
      step: "recommendation",
      expectedInput: null,
    });
  }
  if (optionId === "recommend_included") {
    return exchange(session, label, resolveRecommendation(answers).included, {
      step: "recommendation",
      expectedInput: null,
    });
  }
  if (optionId === "recommend_timeline") {
    return exchange(session, label, resolveRecommendation(answers).timeline, {
      step: "recommendation",
      expectedInput: null,
    });
  }
  if (optionId === "recommend_why") {
    return exchange(session, label, resolveRecommendation(answers).why, {
      step: "recommendation",
      expectedInput: null,
    });
  }
  if (optionId === "recommend_start") {
    return exchange(session, label, "How would you like James to reach you?", {
      step: "follow_up",
      expectedInput: null,
    });
  }
  if (optionId === "recommend_change") {
    return exchange(session, label, "No problem. Let’s restart the project questions so the recommendation can be recalculated cleanly. What type of business is this for?", {
      intent: "buy",
      step: "business_type",
      expectedInput: null,
      answers: emptyAnswers(),
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
    return exchange(session, label, "Enter your best phone number below.", {
      answers,
      step: "follow_up",
      expectedInput: "phone",
    });
  }
  if (optionId === "project_not_ready") {
    return exchange(session, label, "No problem. Your recommendation and answers are still here whenever you are ready.", {
      step: "recommendation",
      expectedInput: null,
    });
  }

  return exchange(session, label, "Choose one of the available next steps below.", {
    step: session.step,
    expectedInput: session.expectedInput,
  });
}

export function submitJGAssistantInput(session: JGAssistantSession, raw: string): JGAssistantSession {
  const value = raw.trim();
  if (!value) return session;
  const answers = { ...session.answers };

  if (session.expectedInput === "custom_business") {
    answers.businessType = value;
    return exchange(session, value, "What is the primary goal for this project?", {
      intent: "buy",
      answers,
      step: "goal",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "custom_goal") {
    answers.goal = value;
    return exchange(session, value, "Which best describes your current situation?", {
      answers,
      step: "current_situation",
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
  const recommendation = resolveRecommendation(session.answers);

  const recommendationOptions: AssistantOption[] =
    recommendation.service === "not_sure"
      ? [
          { id: "recommend_why", label: "Why a Project Review?" },
          { id: "recommend_included", label: "What Happens Next" },
          { id: "recommend_start", label: "Start My Project" },
          { id: "recommend_change", label: "Change My Answers" },
        ]
      : [
          { id: "recommend_why", label: "Why This Recommendation?" },
          { id: "recommend_price", label: "Estimated Starting Price" },
          { id: "recommend_included", label: "What’s Included" },
          { id: "recommend_timeline", label: "Typical Timeline" },
          { id: "recommend_start", label: "Start My Project" },
          { id: "recommend_change", label: "Change My Answers" },
        ];

  const optionMap: Record<AssistantStep, AssistantOption[]> = {
    opening: [
      { id: "intent_buy", label: "I Want to Start a Project" },
      { id: "intent_learn", label: "I Want to Find Something Out" },
    ],
    learn_menu: [
      { id: "learn_pricing", label: "Pricing & Packages" },
      { id: "learn_fit", label: "Which Service Fits My Business?" },
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
    goal: [
      { id: "goal_leads", label: "Get More Leads" },
      { id: "goal_calls", label: "Get More Calls / Bookings" },
      { id: "goal_credibility", label: "Improve Trust / Credibility" },
      { id: "goal_sales", label: "Sell Products Online" },
      { id: "goal_design", label: "Improve Branding / Visuals" },
      { id: "goal_automation", label: "Save Time / Automate Work" },
      { id: "goal_support", label: "Improve Customer Support" },
      { id: "goal_other", label: "Something Else" },
    ],
    current_situation: [
      { id: "situation_scratch", label: "Starting From Scratch" },
      { id: "situation_outdated", label: "Existing Website Is Outdated" },
      { id: "situation_good_site", label: "Already Have a Good Website" },
      { id: "situation_ai", label: "Already Use Some AI Tools" },
      { id: "situation_exploring", label: "Just Exploring" },
    ],
    frustration: [
      { id: "frustration_leads", label: "Losing Leads" },
      { id: "frustration_manual", label: "Too Much Manual Work" },
      { id: "frustration_outdated", label: "Website Looks Outdated" },
      { id: "frustration_branding", label: "Need Better Branding" },
      { id: "frustration_several", label: "Need Several Things" },
      { id: "frustration_unsure", label: "Not Sure" },
    ],
    budget: [
      { id: "budget_under_500", label: "Under $500" },
      { id: "budget_500_1500", label: "$500 to $1,500" },
      { id: "budget_1500_5000", label: "$1,500 to $5,000" },
      { id: "budget_5000_plus", label: "$5,000+" },
      { id: "budget_unsure", label: "Not Sure Yet" },
    ],
    timeline: [
      { id: "timeline_asap", label: "As Soon As Possible" },
      { id: "timeline_month", label: "This Month" },
      { id: "timeline_one_three", label: "1 to 3 Months" },
      { id: "timeline_planning", label: "Just Planning" },
    ],
    recommendation: recommendationOptions,
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
    custom_goal: "Describe the result you want",
    email: "Enter your email",
    phone: "Enter your phone number",
  };

  return {
    options: session.expectedInput ? [] : optionMap[session.step],
    inputPlaceholder: session.expectedInput ? placeholders[session.expectedInput] : null,
  };
}

export function buildJGContactUrl(answers: AssistantAnswers): string {
  const params = new URLSearchParams();
  params.set("service", answers.service ?? "not_sure");
  if (answers.businessType) params.set("business_type", answers.businessType);
  if (answers.goal) params.set("project_need", answers.goal);
  if (answers.currentSituation) params.set("current_situation", answers.currentSituation);
  if (answers.frustration) params.set("biggest_frustration", answers.frustration);
  if (answers.budget) params.set("budget", answers.budget);
  if (answers.timeline) params.set("timeline", answers.timeline);
  if (answers.followUp) params.set("preferred_contact", answers.followUp);
  if (answers.email) params.set("email", answers.email);
  if (answers.phone) params.set("phone", answers.phone);

  const recommendation = resolveRecommendation(answers);
  params.set("notes_from_chatbot", `${recommendation.title}: ${recommendation.summary}`);
  return `/contact?${params.toString()}`;
}

export function buildJGDirectEmailUrl(answers: AssistantAnswers): string {
  const recommendation = resolveRecommendation(answers);
  const subject = encodeURIComponent(`New ${recommendation.title} inquiry from JG Creative Studio website`);
  const body = encodeURIComponent(
    `Hi James,\n\nBusiness: ${answers.businessType || "Not specified"}\nPrimary goal: ${answers.goal || "Not specified"}\nCurrent situation: ${answers.currentSituation || "Not specified"}\nBiggest frustration: ${answers.frustration || "Not specified"}\nBudget: ${answers.budget || "Not specified"}\nTimeline: ${answers.timeline || "Not specified"}\nRecommended service: ${recommendation.title}\n\nRecommendation summary:\n${recommendation.summary}\n\nEmail: ${answers.email || "Not provided"}\nPhone: ${answers.phone || "Not provided"}`,
  );
  return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
}