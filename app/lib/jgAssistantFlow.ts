export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v5";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "design" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput = "custom_business" | "custom_goal" | "email" | "phone" | null;
export type AssistantMessage = { id: string; role: "assistant" | "user"; text: string };
export type AssistantAnswers = {
  service: AssistantService;
  businessType: string;
  goal: string;
  followUp: FollowUpMethod;
  email: string;
  phone: string;
};
export type AssistantStep =
  | "opening"
  | "learn_menu"
  | "service_menu"
  | "business_type"
  | "goal"
  | "detail_menu"
  | "follow_up"
  | "handoff";
export type JGAssistantSession = {
  version: 5;
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
  if (pathname.startsWith("/pricing")) return "I can help you compare packages or find the simplest fit.";
  if (pathname.startsWith("/services")) return "I can help narrow down which service fits your business.";
  if (pathname.startsWith("/ai-tools")) return "I can help identify a practical AI setup for your business.";
  return "Hey, I’m the JG Assistant. I can guide you to the right service or explain how everything works.";
};

const recommendation = (answers: AssistantAnswers) => {
  const business = answers.businessType ? ` for your ${answers.businessType}` : "";
  if (answers.service === "design") return `A focused design package${business} is the best starting point. Single designs begin at $20+, and a three-design flyer pack begins at $49+.`;
  if (answers.service === "ai") return `An AI Starter Setup${business} is the best first step. Starter setups begin at $39+, while advanced automations begin at $149+ after scope is confirmed.`;
  if (answers.service === "website") return `A website project${business} is the best fit. Refreshes begin at $79+, starter websites at $129+, and business websites at $249+.`;
  return `The best first step is a quick project review so James can match the simplest service to your goal.`;
};

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession {
  return {
    version: 5,
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
    if (parsed.version !== 5 || !Array.isArray(parsed.messages)) return createInitialJGAssistantSession(pathname);
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
  const answers = { ...session.answers };

  if (optionId === "intent_buy" || optionId === "start_project") {
    return exchange(session, label, "What kind of project are you considering?", {
      intent: "buy",
      step: "service_menu",
      expectedInput: null,
    });
  }

  if (optionId === "intent_learn" || optionId === "back_learn") {
    return exchange(session, label, "What would you like to learn about?", {
      intent: "learn",
      step: "learn_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_pricing") {
    return exchange(session, label, "Website work begins at $79+, design at $20+, and AI setups at $39+. Choose a service for the most relevant next step.", {
      step: "service_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_fit") {
    return exchange(session, label, "Choose the type of help you are considering and I’ll narrow down the best fit.", {
      step: "service_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_process") {
    return exchange(session, label, "The process is scope, content and assets, build, review, and launch. Choose what you want next.", {
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_timeline") {
    return exchange(session, label, "Timing depends on scope and content readiness. Choose a service so I can guide the next step.", {
      step: "service_menu",
      expectedInput: null,
    });
  }

  if (optionId === "learn_support") {
    return exchange(session, label, "Ongoing support can cover updates, fixes, content changes, and continued improvements. Choose what you want next.", {
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (optionId.startsWith("service_")) {
    answers.service = optionId.replace("service_", "") as AssistantService;
    return exchange(session, label, "What type of business is this for?", {
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
    return exchange(session, label, "What is the main result you want from this project?", {
      answers,
      step: "goal",
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
    return exchange(session, label, `${recommendation(answers)} What would you like to know next?`, {
      answers,
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "detail_pricing") {
    return exchange(session, label, "Website refreshes begin at $79+, starter websites at $129+, business websites at $249+, design at $20+, and AI setups at $39+.", {
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "detail_timeline") {
    return exchange(session, label, "Small design jobs and updates can move quickly. Full websites and custom automations take longer because they need more review and testing.", {
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "detail_process") {
    return exchange(session, label, "James confirms the goal, gathers content and assets, builds the project, reviews it with you, and then launches or delivers it.", {
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (optionId === "detail_support") {
    return exchange(session, label, "Ongoing support is available for updates, small fixes, content changes, and continued improvements.", {
      step: "detail_menu",
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

  return exchange(session, label, "Choose the next step below.", {
    step: "learn_menu",
    expectedInput: null,
  });
}

export function submitJGAssistantInput(session: JGAssistantSession, raw: string): JGAssistantSession {
  const value = raw.trim();
  const answers = { ...session.answers };

  if (session.expectedInput === "custom_business") {
    answers.businessType = value;
    return exchange(session, value, "What is the main result you want from this project?", {
      answers,
      step: "goal",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "custom_goal") {
    answers.goal = value;
    return exchange(session, value, `${recommendation(answers)} What would you like to know next?`, {
      answers,
      step: "detail_menu",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "email") {
    answers.email = value;
    return exchange(session, value, "Your project summary is ready.", {
      answers,
      step: "handoff",
      expectedInput: null,
    });
  }

  if (session.expectedInput === "phone") {
    answers.phone = value;
    return exchange(session, value, "Your project summary is ready.", {
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
      { id: "start_project", label: "Start My Project" },
    ],
    service_menu: [
      { id: "service_website", label: "Website" },
      { id: "service_design", label: "Design Services" },
      { id: "service_ai", label: "AI Systems" },
      { id: "service_not_sure", label: "Not Sure Yet" },
      { id: "back_learn", label: "Back to Information" },
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
      { id: "goal_time", label: "Save Time / Automate Work" },
      { id: "goal_other", label: "Something Else" },
    ],
    detail_menu: [
      { id: "detail_pricing", label: "Pricing" },
      { id: "detail_timeline", label: "Typical Timeline" },
      { id: "detail_process", label: "What’s Included / Process" },
      { id: "detail_support", label: "Ongoing Support" },
      { id: "start_project", label: "Start My Project" },
      { id: "back_learn", label: "Ask About Something Else" },
    ],
    follow_up: [
      { id: "followup_email", label: "Email" },
      { id: "followup_phone", label: "Phone / Text" },
      { id: "back_learn", label: "Not Ready Yet" },
    ],
    handoff: [],
  };

  const placeholders: Record<Exclude<ExpectedInput, null>, string> = {
    custom_business: "Type your business type",
    custom_goal: "Type the result you want",
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
  if (answers.followUp) params.set("preferred_contact", answers.followUp);
  if (answers.email) params.set("email", answers.email);
  if (answers.phone) params.set("phone", answers.phone);
  params.set("notes_from_chatbot", recommendation(answers));
  return `/contact?${params.toString()}`;
}

export function buildJGDirectEmailUrl(answers: AssistantAnswers): string {
  const subject = encodeURIComponent("New inquiry from JG Creative Studio website");
  const body = encodeURIComponent(
    `Hi James,\n\nBusiness: ${answers.businessType || "Not specified"}\nService: ${answers.service || "Not specified"}\nGoal: ${answers.goal || "Not specified"}\n\nRecommendation:\n${recommendation(answers)}\n\nEmail: ${answers.email || "Not provided"}\nPhone: ${answers.phone || "Not provided"}`,
  );
  return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
}
