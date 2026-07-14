export const JG_ASSISTANT_STORAGE_KEY = "jg-assistant-session-v2";

export type AssistantIntent = "buy" | "learn" | null;
export type AssistantService = "website" | "flyers" | "ai" | "not_sure" | null;
export type FollowUpMethod = "email" | "phone" | null;
export type ExpectedInput =
  | "businessType"
  | "domain"
  | "promoWhat"
  | "goal"
  | "email"
  | "phone"
  | null;

export type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type AssistantAnswers = {
  service: AssistantService;
  websiteType: "one_page" | "multi_page" | "store" | "not_sure" | null;
  promoType: "flyer" | "social_pack" | "both" | "not_sure" | null;
  aiGoal:
    | "faster_replies"
    | "better_marketing"
    | "reviews_followups"
    | "automating_tasks"
    | "not_sure"
    | null;
  aiWhere: "text_phone" | "email" | "social" | "website" | "not_sure" | null;
  aiSetupType: "basic" | "pro" | "not_sure" | null;
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

export type AssistantStep =
  | "opening"
  | "service"
  | "website_type"
  | "domain_have"
  | "promo_type"
  | "promo_assets"
  | "promo_deadline"
  | "ai_goal"
  | "ai_where"
  | "ai_setup"
  | "follow_up"
  | "handoff"
  | "learn_topics"
  | "learn_follow_up";

export type JGAssistantSession = {
  version: 2;
  intent: AssistantIntent;
  step: AssistantStep;
  expectedInput: ExpectedInput;
  activePathname: string;
  messages: AssistantMessage[];
  answers: AssistantAnswers;
  lastLearnTopic: string | null;
};

export type AssistantOption = { id: string; label: string };
export type AssistantView = {
  options: AssistantOption[];
  inputPlaceholder: string | null;
};

const emptyAnswers = (): AssistantAnswers => ({
  service: null,
  websiteType: null,
  promoType: null,
  aiGoal: null,
  aiWhere: null,
  aiSetupType: null,
  businessType: "",
  domainHave: null,
  domainValue: "",
  promoWhat: "",
  promoAssets: null,
  promoDeadline: null,
  goal: "",
  followUp: null,
  email: "",
  phone: "",
});

function messageId() {
  return `jg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function assistant(text: string): AssistantMessage {
  return { id: messageId(), role: "assistant", text };
}

function user(text: string): AssistantMessage {
  return { id: messageId(), role: "user", text };
}

function openingCopy(pathname: string): string {
  if (pathname.startsWith("/services")) {
    return "You’re looking at Services. I can help you figure out what to buy, or explain which service best fits what you are trying to accomplish.";
  }
  if (pathname.startsWith("/ai-tools")) {
    return "You’re looking at AI Systems. I can help you choose an AI setup, explain what is possible, or turn your idea into a project request.";
  }
  if (pathname.startsWith("/examples")) {
    return "You’re looking at the portfolio. I can help you find the most relevant type of work or start a similar project for your business.";
  }
  if (pathname.startsWith("/about")) {
    return "You’re on About. I can explain how JG Creative Studio works, what I build, or help you start a project.";
  }
  if (pathname.startsWith("/contact")) {
    return "You’re on Contact. I can organize what you need before you send the form, or answer a few questions first.";
  }
  if (pathname.startsWith("/faq")) {
    return "You’re on Quick Answers. I can explain a service, process, timeline, or help you start a project.";
  }
  return "Hey, I’m the JG Assistant. I can help you figure out what you want to buy or answer questions about websites, AI systems, design, and how the process works.";
}

function routeName(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/services")) return "Services";
  if (pathname.startsWith("/ai-tools")) return "AI Systems";
  if (pathname.startsWith("/examples")) return "Portfolio";
  if (pathname.startsWith("/about")) return "About";
  if (pathname.startsWith("/contact")) return "Contact";
  if (pathname.startsWith("/faq")) return "FAQ";
  return "JG Creative Studio";
}

export function createInitialJGAssistantSession(pathname: string): JGAssistantSession {
  return {
    version: 2,
    intent: null,
    step: "opening",
    expectedInput: null,
    activePathname: pathname,
    messages: [assistant(openingCopy(pathname))],
    answers: emptyAnswers(),
    lastLearnTopic: null,
  };
}

export function parseStoredJGAssistantSession(
  raw: string | null,
  pathname: string,
): JGAssistantSession {
  if (!raw) return createInitialJGAssistantSession(pathname);
  try {
    const parsed = JSON.parse(raw) as Partial<JGAssistantSession>;
    if (parsed.version !== 2 || !Array.isArray(parsed.messages)) {
      return createInitialJGAssistantSession(pathname);
    }
    const messages = parsed.messages.filter(
      (item): item is AssistantMessage =>
        Boolean(
          item &&
            typeof item.id === "string" &&
            (item.role === "assistant" || item.role === "user") &&
            typeof item.text === "string",
        ),
    );
    return {
      ...createInitialJGAssistantSession(pathname),
      ...parsed,
      activePathname: pathname,
      messages: messages.length ? messages : [assistant(openingCopy(pathname))],
      answers: { ...emptyAnswers(), ...(parsed.answers ?? {}) },
    };
  } catch {
    return createInitialJGAssistantSession(pathname);
  }
}

export function syncJGAssistantRoute(
  session: JGAssistantSession,
  pathname: string,
): JGAssistantSession {
  if (session.activePathname === pathname) return session;
  const route = routeName(pathname);
  const routeMessage = session.expectedInput
    ? `You’re now on ${route}. I kept everything you already told me, so you can continue where you left off.`
    : `You’re now on ${route}. I kept your conversation and can use this page to guide the next step.`;
  return {
    ...session,
    activePathname: pathname,
    messages: [...session.messages, assistant(routeMessage)],
  };
}

function withExchange(
  session: JGAssistantSession,
  userText: string,
  assistantText: string,
  updates: Partial<JGAssistantSession>,
): JGAssistantSession {
  return {
    ...session,
    ...updates,
    messages: [...session.messages, user(userText), assistant(assistantText)],
  };
}

function learnTopicOptions(pathname: string): AssistantOption[] {
  if (pathname.startsWith("/ai-tools")) {
    return [
      { id: "learn_ai_capabilities", label: "What can an AI system do?" },
      { id: "learn_ai_process", label: "How does an AI project work?" },
      { id: "learn_pricing", label: "How is pricing decided?" },
      { id: "learn_timeline", label: "How long does it take?" },
    ];
  }
  if (pathname.startsWith("/services")) {
    return [
      { id: "learn_service_fit", label: "Which service fits me?" },
      { id: "learn_websites", label: "Tell me about websites" },
      { id: "learn_ai_capabilities", label: "Tell me about AI systems" },
      { id: "learn_design", label: "Tell me about design work" },
    ];
  }
  if (pathname.startsWith("/examples")) {
    return [
      { id: "learn_examples", label: "What kind of work is shown here?" },
      { id: "learn_service_fit", label: "What could you build for me?" },
      { id: "learn_process", label: "What happens after I reach out?" },
      { id: "learn_pricing", label: "How is pricing decided?" },
    ];
  }
  return [
    { id: "learn_service_fit", label: "Which service fits me?" },
    { id: "learn_process", label: "How does the process work?" },
    { id: "learn_timeline", label: "How long does a project take?" },
    { id: "learn_pricing", label: "How is pricing decided?" },
    { id: "learn_support", label: "Do you offer ongoing support?" },
  ];
}

function learnAnswer(optionId: string): string {
  switch (optionId) {
    case "learn_websites":
      return "Website projects can range from a focused one-page site to a larger business website or online store. The goal is not just to make it look good. It should clearly explain the business, build trust, and make the next action obvious.";
    case "learn_ai_capabilities":
      return "AI systems can help with customer replies, intake, follow-ups, internal workflows, content support, lead handling, and custom website assistants. The setup depends on where the work is happening and what should be automated.";
    case "learn_ai_process":
      return "An AI project starts with the job the system needs to perform. From there, I map the inputs, decisions, outputs, and handoffs, then build the smallest reliable system that solves the real problem.";
    case "learn_design":
      return "Design work includes flyers, promotional graphics, social media packs, and branded campaign assets. The project is shaped around what you are promoting, what assets already exist, and when it is needed.";
    case "learn_examples":
      return "The portfolio shows the range of websites, product interfaces, and business systems I can build. The best comparison depends on whether you need a public-facing website, an internal tool, or an AI-driven workflow.";
    case "learn_process":
      return "The process is simple: define what the project needs to accomplish, confirm the scope and materials, agree on the build, then move through creation, review, and launch. The assistant can organize those details before you contact me.";
    case "learn_timeline":
      return "Simple website or design projects can move quickly when the content and assets are ready. Larger websites and custom AI systems take longer because the scope, integrations, and testing are more involved. I confirm the real timeline after reviewing the project details.";
    case "learn_pricing":
      return "Pricing is based on scope, complexity, content, integrations, and how custom the project needs to be. The assistant can collect enough information for a clear quote instead of guessing from one sentence.";
    case "learn_support":
      return "Yes. Ongoing support can cover updates, maintenance, content changes, system improvements, and continued help after launch, depending on the project.";
    default:
      return "The right service depends on the outcome. A website is best when the business needs stronger credibility or conversion. Design work fits a specific promotion or campaign. An AI system fits repeated work that should become faster, more consistent, or automated.";
  }
}

export function chooseJGAssistantOption(
  session: JGAssistantSession,
  optionId: string,
  label: string,
): JGAssistantSession {
  if (optionId === "intent_buy" || optionId === "start_project") {
    return withExchange(session, label, "Great. What are you looking to build or buy?", {
      intent: "buy",
      step: "service",
      expectedInput: null,
    });
  }
  if (optionId === "intent_learn") {
    return withExchange(session, label, "What would you like to find out?", {
      intent: "learn",
      step: "learn_topics",
      expectedInput: null,
    });
  }
  if (optionId === "learn_another") {
    return withExchange(session, label, "What else would you like to find out?", {
      step: "learn_topics",
      expectedInput: null,
    });
  }
  if (optionId.startsWith("learn_")) {
    return withExchange(session, label, learnAnswer(optionId), {
      intent: "learn",
      step: "learn_follow_up",
      expectedInput: null,
      lastLearnTopic: optionId,
    });
  }
  if (optionId.startsWith("service_")) {
    const service = optionId.replace("service_", "") as AssistantService;
    const answers = { ...session.answers, service };
    if (service === "website") {
      return withExchange(session, label, "What type of website are you thinking about?", {
        answers,
        step: "website_type",
      });
    }
    if (service === "flyers") {
      return withExchange(session, label, "What kind of promotional design do you need?", {
        answers,
        step: "promo_type",
      });
    }
    if (service === "ai") {
      return withExchange(session, label, "What do you want the AI system to improve?", {
        answers,
        step: "ai_goal",
      });
    }
    return withExchange(session, label, "What type of business do you run?", {
      answers,
      expectedInput: "businessType",
    });
  }
  if (optionId.startsWith("website_")) {
    const websiteType = optionId.replace("website_", "") as AssistantAnswers["websiteType"];
    return withExchange(session, label, "What type of business is the website for?", {
      answers: { ...session.answers, websiteType },
      expectedInput: "businessType",
    });
  }
  if (optionId.startsWith("domain_")) {
    const domainHave = optionId.replace("domain_", "") as AssistantAnswers["domainHave"];
    return withExchange(
      session,
      label,
      domainHave === "yes" ? "What is the domain name?" : "What is the main goal of the website?",
      {
        answers: { ...session.answers, domainHave },
        expectedInput: domainHave === "yes" ? "domain" : "goal",
      },
    );
  }
  if (optionId.startsWith("promo_")) {
    const promoType = optionId.replace("promo_", "") as AssistantAnswers["promoType"];
    return withExchange(session, label, "What are you promoting?", {
      answers: { ...session.answers, promoType },
      expectedInput: "promoWhat",
    });
  }
  if (optionId.startsWith("assets_")) {
    const promoAssets = optionId.replace("assets_", "") as AssistantAnswers["promoAssets"];
    return withExchange(session, label, "When do you need it?", {
      answers: { ...session.answers, promoAssets },
      step: "promo_deadline",
    });
  }
  if (optionId.startsWith("deadline_")) {
    const promoDeadline = optionId.replace("deadline_", "") as AssistantAnswers["promoDeadline"];
    return withExchange(session, label, "What is the main goal of the promotion?", {
      answers: { ...session.answers, promoDeadline },
      expectedInput: "goal",
    });
  }
  if (optionId.startsWith("aigoal_")) {
    const aiGoal = optionId.replace("aigoal_", "") as AssistantAnswers["aiGoal"];
    return withExchange(session, label, "Where should the AI help happen?", {
      answers: { ...session.answers, aiGoal },
      step: "ai_where",
    });
  }
  if (optionId.startsWith("aiwhere_")) {
    const aiWhere = optionId.replace("aiwhere_", "") as AssistantAnswers["aiWhere"];
    return withExchange(session, label, "What level of setup are you looking for?", {
      answers: { ...session.answers, aiWhere },
      step: "ai_setup",
    });
  }
  if (optionId.startsWith("aisetup_")) {
    const aiSetupType = optionId.replace("aisetup_", "") as AssistantAnswers["aiSetupType"];
    return withExchange(session, label, "What type of business is this for?", {
      answers: { ...session.answers, aiSetupType },
      expectedInput: "businessType",
    });
  }
  if (optionId.startsWith("followup_")) {
    const followUp = optionId.replace("followup_", "") as FollowUpMethod;
    return withExchange(
      session,
      label,
      followUp === "email"
        ? "What is the best email to reach you?"
        : "What is the best phone number to text or call?",
      {
        answers: { ...session.answers, followUp },
        expectedInput: followUp === "email" ? "email" : "phone",
      },
    );
  }
  return session;
}

export function submitJGAssistantInput(
  session: JGAssistantSession,
  value: string,
): JGAssistantSession {
  const text = value.trim();
  if (!text || !session.expectedInput) return session;
  const answers = { ...session.answers };

  if (session.expectedInput === "businessType") {
    answers.businessType = text;
    if (answers.service === "website") {
      return withExchange(session, text, "Do you already have a domain name?", {
        answers,
        expectedInput: null,
        step: "domain_have",
      });
    }
    if (answers.service === "flyers") {
      return withExchange(session, text, "Do you already have a logo, photos, or brand colors to use?", {
        answers,
        expectedInput: null,
        step: "promo_assets",
      });
    }
    return withExchange(session, text, "What is the biggest result you want from this project?", {
      answers,
      expectedInput: "goal",
    });
  }
  if (session.expectedInput === "domain") {
    answers.domainValue = text;
    return withExchange(session, text, "What is the main goal of the website?", {
      answers,
      expectedInput: "goal",
    });
  }
  if (session.expectedInput === "promoWhat") {
    answers.promoWhat = text;
    return withExchange(session, text, "What type of business is this for?", {
      answers,
      expectedInput: "businessType",
    });
  }
  if (session.expectedInput === "goal") {
    answers.goal = text;
    return withExchange(session, text, "What is the best way to follow up with you?", {
      answers,
      expectedInput: null,
      step: "follow_up",
    });
  }
  if (session.expectedInput === "email") answers.email = text;
  if (session.expectedInput === "phone") answers.phone = text;
  return withExchange(
    session,
    text,
    "Perfect. I saved everything you shared. You can open the project request with the details already filled in, or email James directly.",
    { answers, expectedInput: null, step: "handoff" },
  );
}

export function buildJGAssistantView(session: JGAssistantSession): AssistantView {
  if (session.expectedInput) {
    const placeholders: Record<Exclude<ExpectedInput, null>, string> = {
      businessType: "Type your business type…",
      domain: "Type your domain…",
      promoWhat: "What are you promoting?",
      goal: "Describe the result you want…",
      email: "Type your email…",
      phone: "Type your phone number…",
    };
    return { options: [], inputPlaceholder: placeholders[session.expectedInput] };
  }

  const optionsByStep: Partial<Record<AssistantStep, AssistantOption[]>> = {
    opening: [
      { id: "intent_buy", label: "I want to start a project" },
      { id: "intent_learn", label: "I want to find something out" },
    ],
    service: [
      { id: "service_website", label: "Website" },
      { id: "service_ai", label: "AI System" },
      { id: "service_flyers", label: "Flyers / Social" },
      { id: "service_not_sure", label: "Not sure yet" },
    ],
    website_type: [
      { id: "website_one_page", label: "One-page site" },
      { id: "website_multi_page", label: "Multi-page business site" },
      { id: "website_store", label: "Online store" },
      { id: "website_not_sure", label: "Not sure yet" },
    ],
    domain_have: [
      { id: "domain_yes", label: "Yes" },
      { id: "domain_no", label: "No" },
      { id: "domain_not_sure", label: "Not sure" },
    ],
    promo_type: [
      { id: "promo_flyer", label: "Flyer / promo" },
      { id: "promo_social_pack", label: "Social media pack" },
      { id: "promo_both", label: "Both" },
      { id: "promo_not_sure", label: "Not sure yet" },
    ],
    promo_assets: [
      { id: "assets_yes", label: "Yes" },
      { id: "assets_some", label: "Some of it" },
      { id: "assets_no", label: "No" },
    ],
    promo_deadline: [
      { id: "deadline_asap", label: "ASAP" },
      { id: "deadline_few_days", label: "Within a few days" },
      { id: "deadline_next_week", label: "Next week" },
      { id: "deadline_no_rush", label: "No rush" },
    ],
    ai_goal: [
      { id: "aigoal_faster_replies", label: "Faster customer replies" },
      { id: "aigoal_reviews_followups", label: "Reviews / follow-ups" },
      { id: "aigoal_automating_tasks", label: "Automate repeated tasks" },
      { id: "aigoal_better_marketing", label: "Marketing / content" },
      { id: "aigoal_not_sure", label: "Not sure yet" },
    ],
    ai_where: [
      { id: "aiwhere_website", label: "Website" },
      { id: "aiwhere_email", label: "Email" },
      { id: "aiwhere_text_phone", label: "Text / Phone" },
      { id: "aiwhere_social", label: "Social media" },
      { id: "aiwhere_not_sure", label: "Not sure yet" },
    ],
    ai_setup: [
      { id: "aisetup_basic", label: "Basic guided setup" },
      { id: "aisetup_pro", label: "Custom automation" },
      { id: "aisetup_not_sure", label: "Not sure yet" },
    ],
    follow_up: [
      { id: "followup_email", label: "Email" },
      { id: "followup_phone", label: "Phone / Text" },
    ],
    learn_follow_up: [
      { id: "learn_another", label: "Ask about something else" },
      { id: "start_project", label: "Start a project" },
    ],
  };

  if (session.step === "learn_topics") {
    return { options: learnTopicOptions(session.activePathname), inputPlaceholder: null };
  }
  return { options: optionsByStep[session.step] ?? [], inputPlaceholder: null };
}

export function buildJGContactUrl(answers: AssistantAnswers): string {
  let serviceLabel = "Not sure yet";
  if (answers.service === "website") serviceLabel = "Website Creation";
  if (answers.service === "flyers") {
    serviceLabel = answers.promoType === "social_pack" ? "Social Media Posts" : "Flyer / Promo Design";
  }
  if (answers.service === "ai") serviceLabel = "AI Template Setup";

  const params = new URLSearchParams();
  params.set("service", serviceLabel);
  if (answers.businessType) params.set("business_type", answers.businessType);
  if (answers.goal) params.set("goal", answers.goal);
  if (answers.followUp) params.set("preferred_contact", answers.followUp);
  if (answers.email) params.set("email", answers.email);
  if (answers.phone) params.set("phone", answers.phone);

  const notes = [
    answers.websiteType ? `Website type: ${answers.websiteType}` : "",
    answers.domainHave ? `Has domain: ${answers.domainHave}` : "",
    answers.domainValue ? `Domain: ${answers.domainValue}` : "",
    answers.promoType ? `Promo type: ${answers.promoType}` : "",
    answers.promoWhat ? `Promoting: ${answers.promoWhat}` : "",
    answers.promoAssets ? `Has assets: ${answers.promoAssets}` : "",
    answers.promoDeadline ? `Deadline: ${answers.promoDeadline}` : "",
    answers.aiGoal ? `AI goal: ${answers.aiGoal}` : "",
    answers.aiWhere ? `AI location: ${answers.aiWhere}` : "",
    answers.aiSetupType ? `AI setup: ${answers.aiSetupType}` : "",
  ].filter(Boolean);
  if (notes.length) params.set("notes_from_chatbot", notes.join(" | "));
  return `/contact?${params.toString()}`;
}

export function buildJGDirectEmailUrl(answers: AssistantAnswers): string {
  const subject = encodeURIComponent("New inquiry from JG Creative Studio website");
  const body = encodeURIComponent(
    `Hi James,\n\nI was chatting with the JG Assistant and wanted to reach out directly.\n\nService needed:\n${answers.service || "Not specified"}\n\nBusiness type:\n${answers.businessType || "Not specified"}\n\nGoal:\n${answers.goal || "Not specified"}\n\nPreferred follow-up:\n${answers.followUp || "Not specified"}\n\nEmail:\n${answers.email || "Not provided"}\n\nPhone:\n${answers.phone || "Not provided"}\n\nThanks!`,
  );
  return `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
}
