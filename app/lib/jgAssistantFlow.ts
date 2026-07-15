export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v6";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "custom_business" | "custom_goal" | "custom_ai_goal" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  businessType: string;
  goal: string;
  aiGoal: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep =
  | "opening"
  | "learn_menu"
  | "learn_service_menu"
  | "learn_detail_menu"
  | "service_menu"
  | "business_type"
  | "goal"
  | "ai_goal"
  | "project_detail_menu"
  | "follow_up"
  | "handoff";
export type JGAssistantSession = {
  version: 6;
  intent: AssistantIntent;
  step: AssistantStep;
  expectedInput: ExpectedInput;
  activePathname: string;
  messages: AssistantMessage[];
  answers: AssistantAnswers;
};
export type AssistantOption = { id: string; label: string };
export type AssistantView = { options: AssistantOption[]; inputPlaceholder: string | null };

const emptyAnswers = (): AssistantAnswers => ({
  service: null,
  businessType: "",
  goal: "",
  aiGoal: "",
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
  if (pathname.startsWith("/pricing")) return "I can help you compare services or start a project.";
  if (pathname.startsWith("/services")) return "I can explain the services or guide you through starting a project.";
  if (pathname.startsWith("/ai-tools")) return "I can explain the AI options or help scope an AI project.";
  return "Hey, I’m the JG Assistant. I can help you learn about the services or start a project.";
};

const serviceLabel = (service: AssistantService) => {
  if (service === "website") return "Website";
  if (service === "design") return "Design Services";
  if (service === "ai") return "AI Systems";
  return "Project Review";
};

const pricingText = (service: AssistantService) => {
  if (service === "website") return "Website refreshes begin at $79+, starter websites at $129+, and business websites at $249+. Final pricing depends on page count, content, and required features.";
  if (service === "design") return "Single designs begin at $20+, and a three-design flyer pack begins at $49+. Larger branding or multi-asset projects are scoped before work begins.";
  if (service === "ai") return "AI starter setups currently begin at $39+, while advanced automations begin at $149+ after the workflow and integrations are confirmed.";
  return "James will review the goal and recommend the simplest option before providing a starting price.";
};

const timelineText = (service: AssistantService) => {
  if (service === "website") return "A refresh can move quickly when content is ready. New websites take longer because they include structure, content placement, review, and launch testing.";
  if (service === "design") return "Small design requests can usually move quickly. Larger sets and branding work require more review rounds and asset preparation.";
  if (service === "ai") return "Simple AI setups can be completed quickly. Advanced automations take longer because the workflow, tools, permissions, and testing all need to be confirmed.";
  return "Timing is confirmed after the scope and required assets are reviewed.";
};

const processText = (service: AssistantService) => {
  if (service === "website") return "The website process covers scope, content and assets, page structure, build, review, mobile testing, and launch.";
  if (service === "design") return "The design process covers the goal, required size and format, brand assets, first draft, revision, and final delivery.";
  if (service === "ai") return "The AI process covers the current workflow, the task to improve, the tools involved, the proposed setup, testing, and handoff.";
  return "James first confirms the problem, then recommends the smallest project that can solve it properly.";
};

const learnServiceIntro = (service: AssistantService) => {
  if (service === "website") return "Website work ranges from focused refreshes to complete business websites. You can review pricing, process, timeline, or start a project below.";
  if (service === "design") return "Design services cover individual promotional assets, multi-design packs, and larger custom design needs. Choose what you want to review.";
  if (service === "ai") return "AI systems currently cover starter setups and more advanced workflow automations. Choose what you want to review.";
  return "A quick project review is the best option when the right service is not obvious. Choose what you want to know next.";
};

const recommendation = (answers: AssistantAnswers) => {
  const business = answers.businessType ? ` for your ${answers.businessType}` : "";
  const goal = answers.aiGoal || answers.goal;
  const goalContext = goal ? ` Your priority is ${goal.toLowerCase()}.` : "";

  if (answers.service === "website") {
    return `A website project${business} is the best fit.${goalContext} James can determine whether a refresh, starter website, or business website gives you enough room without paying for unnecessary scope.`;
  }
  if (answers.service === "design") {
    return `A focused design project${business} is the best starting point.${goalContext} The final recommendation will depend on whether you need one asset, a coordinated pack, or a larger visual system.`;
  }
  if (answers.service === "ai") {
    return `An AI system review${business} is the best first step.${goalContext} James can map the current workflow and decide whether a starter setup or a more advanced automation is justified.`;
  }
  return `A quick project review${business} is the best next step.${goalContext} James can match the goal to the simplest service instead of forcing it into the wrong package.`;
};

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession {
  return {
    version: 6,
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
    if (parsed.version !== 6 || !Array.isArray(parsed.messages)) return createInitialJGAssistantSession(pathname);
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
    return exchange(session, label, "What kind of project are you considering?", {
      intent: "buy",
      step: "service_menu",
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

  if (["learn_pricing", "learn_fit", "learn_timeline"].includes(optionId)) {
    return exchange(session, label, "Choose a service so I can give you the relevant information.", {
      intent: "learn",
      step: "learn_service_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_process") {
    answers.service = "not_sure";
    return exchange(session, label, processText(answers.service), {
      intent: "learn",
      step: "learn_detail_menu",
      expectedInput: null,
      answers,
    });
  }

  if (optionId === "learn_support") {
    answers.service = "not_sure";
    return exchange(session, label, "Ongoing support can cover updates, fixes, content changes, and continued improvements after delivery.", {
      intent: "learn",
      step: "learn_detail_menu",
      expectedInput: null,
      answers,
    });
  }

  if (optionId.startsWith("learn_service_")) {
    answers.service = optionId.replace("learn_service_", "") as AssistantService;
    return exchange(session, label, learnServiceIntro(answers.service), {
      intent: "learn",
      step: "learn_detail_menu",
      expectedInput: null,
      answers,
    });
  }

  if (optionId === "learn_detail_pricing") {
    return exchange(session, label, pricingText(answers.service), { step: "learn_detail_menu", expectedInput: null });
  }

  if (optionId === "learn_detail_timeline") {
    return exchange(session, label, timelineText(answers.service), { step: "learn_detail_menu", expectedInput: null });
  }

  if (optionId === "learn_detail_process") {
    return exchange(session, label, processText(answers.service), { step: "learn_detail_menu", expectedInput: null });
  }

  if (optionId === "learn_detail_support") {
    return exchange(session, label, "Ongoing support is available for updates, small fixes, content changes, and continued improvements.", {
      step: "learn_detail_menu",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("service_")) {
    answers.service = optionId.replace("service_", "") as AssistantService;
    return exchange(session, label, "What type of business is this for?", {
      intent: "buy",
      answers,
      step: "business_type",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("business_")) {
    if (optionId === "business_other") {
      return exchange(session, label, "Type the business type below.", {
        answers,
        step: "business_type",
        expectedInput: "custom_business",
      });
    }
    answers.businessType = label;
    const nextStep: AssistantStep = answers.service === "ai" ? "ai_goal" : "goal";
    const nextQuestion = answers.service === "ai"
      ? "What should the AI system help you improve first?"
      : "What is the main result you want from this project?";
    return exchange(session, label, nextQuestion, {
      answers,
      step: nextStep,
      expectedInput: null,
    });
  }

  if (optionId.startsWith("goal_")) {
    if (optionId === "goal_other") {
      return exchange(session, label, "Type the result you want below.", {
        answers,
        step: "goal",
        expectedInput: "custom_goal",
      });
    }
    answers.goal = label;
    return exchange(session, label, `${recommendation(answers)} Choose what you want to review before starting.`, {
      answers,
      step: "project_detail_menu",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("ai_goal_")) {
    if (optionId === "ai_goal_other") {
      return exchange(session, label, "Type the workflow or result you want AI to improve.", {
        answers,
        step: "ai_goal",
        expectedInput: "custom_ai_goal",
      });
    }
    answers.aiGoal = label;
    return exchange(session, label, `${recommendation(answers)} Choose what you want to review before starting.`, {
      answers,
      step: "project_detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "project_pricing") {
    return exchange(session, label, pricingText(answers.service), { step: "project_detail_menu", expectedInput: null });
  }

  if (optionId === "project_timeline") {
    return exchange(session, label, timelineText(answers.service), { step: "project_detail_menu", expectedInput: null });
  }

  if (optionId === "project_process") {
    return exchange(session, label, processText(answers.service), { step: "project_detail_menu", expectedInput: null });
  }

  if (optionId === "project_start") {
    return exchange(session, label, "How would you like James to reach you?", {
      intent: "buy",
      step: "follow_up",
      expectedInput: null,
    });
  }

  if (optionId === "project_change") {
    answers = emptyAnswers();
    return exchange(session, label, "No problem. What kind of project are you considering?", {
      intent: "buy",
      step: "service_menu",
      expectedInput: null,
      answers,
    });
  }

  if (optionId === "project_not_ready") {
    return exchange(session, label, "No problem. Your project details are still here if you want to review anything else.", {
      step: "project_detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "followup_email") {
    answers.followUp = "email";
    return exchange(session, label, "What is the best email to reach you?", {
      answers,
      step: "follow_up",
      expectedInput: "email",
    });
  }

  if (optionId === "followup_phone") {
    answers.followUp = "phone";
    return exchange(session, label, "What is the best phone number to call or text?", {
      answers,
      step: "follow_up",
      expectedInput: "phone",
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
    const nextStep: AssistantStep = answers.service === "ai" ? "ai_goal" : "goal";
    const nextQuestion = answers.service === "ai"
      ? "What should the AI system help you improve first?"
      : "What is the main result you want from this project?";
    return exchange(session, value, nextQuestion, {
      answers,
      step: nextStep,
      expectedInput: null,
    });
  }

  if (session.expectedInput === "custom_goal") {
    answers.goal = value;
    return exchange(session, value, `${recommendation(answers)} Choose what you want to review before starting.`, {
      answers,
      step: "project_detail_menu",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "custom_ai_goal") {
    answers.aiGoal = value;
    return exchange(session, value, `${recommendation(answers)} Choose what you want to review before starting.`, {
      answers,
      step: "project_detail_menu",
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
      { id: "learn_detail_support", label: "Ongoing Support" },
      { id: "learn_start_project", label: "Start My Project" },
      { id: "learn_back", label: "Back to Information" },
    ],
    service_menu: [
      { id: "service_website", label: "Website" },
      { id: "service_design", label: "Design Services" },
      { id: "service_ai", label: "AI Systems" },
      { id: "service_not_sure", label: "Not Sure Yet" },
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
      { id: "goal_credibility", label: "Build Trust / Credibility" },
      { id: "goal_sales", label: "Sell Products Online" },
      { id: "goal_time", label: "Save Time / Simplify Work" },
      { id: "goal_other", label: "Something Else" },
    ],
    ai_goal: [
      { id: "ai_goal_admin", label: "Automate Repetitive Admin Work" },
      { id: "ai_goal_leads", label: "Capture or Qualify Leads" },
      { id: "ai_goal_support", label: "Improve Customer Support" },
      { id: "ai_goal_content", label: "Create or Organize Content" },
      { id: "ai_goal_workflow", label: "Connect Tools / Improve a Workflow" },
      { id: "ai_goal_other", label: "Something Else" },
    ],
    project_detail_menu: [
      { id: "project_pricing", label: "Estimated Starting Price" },
      { id: "project_process", label: "What’s Included" },
      { id: "project_timeline", label: "Typical Timeline" },
      { id: "project_start", label: "Start My Project" },
      { id: "project_change", label: "Change My Answers" },
    ],
    follow_up: [
      { id: "followup_email", label: "Email" },
      { id: "followup_phone", label: "Phone / Text" },
      { id: "project_not_ready", label: "Not Ready Yet" },
    ],
    handoff: [],
  };

  const placeholders: Record<Exclude<ExpectedInput, null>, string> = {
    custom_business: "Type your business type",
    custom_goal: "Type the result you want",
    custom_ai_goal: "Describe the workflow or result",
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
  if (answers.goal) params.set("goal", answers.goal);
  if (answers.aiGoal) params.set("ai_goal", answers.aiGoal);
  if (answers.followUp) params.set("preferred_contact", answers.followUp);
  if (answers.email) params.set("email", answers.email);
  if (answers.phone) params.set("phone", answers.phone);
  params.set("notes_from_chatbot", recommendation(answers));
  return `/contact?${params.toString()}`;
}

export function buildJGDirectEmailUrl(answers: AssistantAnswers): string {
  const subject = encodeURIComponent(`New ${serviceLabel(answers.service)} inquiry from JG Creative Studio website`);
  const body = encodeURIComponent(
    `Hi James,\n\nBusiness: ${answers.businessType || "Not specified"}\nService: ${serviceLabel(answers.service)}\nGoal: ${answers.aiGoal || answers.goal || "Not specified"}\n\nRecommendation:\n${recommendation(answers)}\n\nEmail: ${answers.email || "Not provided"}\nPhone: ${answers.phone || "Not provided"}`,
  );
  return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
}
