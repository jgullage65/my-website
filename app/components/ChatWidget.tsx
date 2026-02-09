"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "bot" | "user";

type Message = {
  role: Role;
  text: string;
};

type Intent =
  | "idle"
  | "choose_service"
  | "collect_business_type"
  | "collect_contact_method"
  | "handoff";

type ServiceKey = "website" | "flyers_social" | "ai_setup" | "unknown";

const CONTACT_URL = "/contact";

// If you later add querystring support on Contact, keep these names consistent.
function buildContactLink(service: ServiceKey, businessType?: string, contactMethod?: string) {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  if (businessType) params.set("business_type", businessType);
  if (contactMethod) params.set("contact_method", contactMethod);
  return `${CONTACT_URL}?${params.toString()}`;
}

function normalize(s: string) {
  return s.toLowerCase().trim();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((n) => haystack.includes(n));
}

/** ✅ Your FAQ “source of truth” */
const FAQ = [
  {
    q: "How fast can you build a website?",
    a: "Most simple sites take 3–7 days depending on how many pages and how quickly you can send your info (logo, services, photos, etc.).",
    keywords: ["how fast", "turnaround", "how long", "days", "timeline", "build", "website"],
  },
  {
    q: "What do you need from me to get started?",
    a: "Business name, what you offer, your contact info, and any photos/logos you have. If you don’t have photos, we can still launch clean and add later.",
    keywords: ["get started", "what do you need", "need from me", "info", "logo", "photos", "start"],
  },
  {
    q: "Do you do monthly updates and maintenance?",
    a: "Yes. If you want ongoing updates (new offers, text changes, photo swaps, etc.) we can do a monthly plan so you’re not stuck trying to edit things yourself.",
    keywords: ["maintenance", "monthly", "updates", "update my site", "ongoing", "edit"],
  },
  {
    q: "Can you redesign my current website?",
    a: "Yes. If your site looks outdated or is hard to use on mobile, I can rebuild it with a modern layout and clearer messaging.",
    keywords: ["redesign", "rebuild", "outdated", "current website", "refresh", "hard to use", "mobile"],
  },
  {
    q: "Do you offer flyers and social media too?",
    a: "Yes. Flyers, promos, and social graphics that are sized correctly for Facebook/Instagram and match your brand style.",
    keywords: ["flyer", "flyers", "social", "instagram", "facebook", "promo", "graphics", "posts"],
  },
  {
    q: "What are AI templates and how do they help?",
    a: "They’re reusable message/workflow templates that help you respond faster, write captions, send review requests, and stay consistent without thinking about it every time.",
    keywords: ["ai", "templates", "automation", "workflows", "respond faster", "captions", "review requests"],
  },
  {
    q: "Do you handle hosting and deployment?",
    a: "Yes. I can deploy your site and make sure it’s live and working. If you want a custom domain, I can help set that up too.",
    keywords: ["hosting", "deploy", "deployment", "domain", "custom domain", "live site"],
  },
  {
    q: "What if I’m not sure what I need?",
    a: "Totally fine. Tell me your business and what you’re trying to improve — I’ll recommend the simplest option that gets results.",
    keywords: ["not sure", "dont know", "don't know", "help me decide", "what do i need", "confused"],
  },
] as const;

function matchFAQ(userText: string) {
  const t = normalize(userText);
  // score by number of keyword hits so the best match wins
  let best: { idx: number; score: number } | null = null;

  for (let i = 0; i < FAQ.length; i++) {
    const hitCount = FAQ[i].keywords.reduce((acc, kw) => acc + (t.includes(kw) ? 1 : 0), 0);
    if (hitCount > 0) {
      if (!best || hitCount > best.score) best = { idx: i, score: hitCount };
    }
  }
  return best ? FAQ[best.idx] : null;
}

export default function JGChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text:
        "Hey — I’m the JG Creative Studio helper.\n\nAsk a quick question, or tap a button and I’ll guide you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [intent, setIntent] = useState<Intent>("idle");

  const [service, setService] = useState<ServiceKey>("unknown");
  const [businessType, setBusinessType] = useState<string>("");
  const [contactMethod, setContactMethod] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, [messages, open]);

  const suggestedButtons = useMemo(() => {
    // If we’re in a guided flow, show the appropriate buttons
    if (intent === "choose_service") {
      return [
        { label: "Website", value: "website" as ServiceKey },
        { label: "Flyers / Social", value: "flyers_social" as ServiceKey },
        { label: "AI Setup", value: "ai_setup" as ServiceKey },
      ];
    }
    if (intent === "collect_contact_method") {
      return [
        { label: "Email", value: "Email" },
        { label: "Text", value: "Text" },
        { label: "Phone Call", value: "Phone Call" },
      ];
    }
    return null;
  }, [intent]);

  function pushBot(text: string) {
    setMessages((m) => [...m, { role: "bot", text }]);
  }

  function pushUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
  }

  function startGuidedFlow() {
    setIntent("choose_service");
    pushBot("What are you looking for help with?");
  }

  function handleServicePick(s: ServiceKey) {
    setService(s);
    setIntent("collect_business_type");

    const label =
      s === "website" ? "Website" : s === "flyers_social" ? "Flyers / Social" : s === "ai_setup" ? "AI Setup" : "Not sure";

    pushBot(`Got it: **${label}**.\n\nWhat type of business do you run? (Example: barber shop, cleaning, contractor, church event, etc.)`);
  }

  function handleBusinessType(text: string) {
    setBusinessType(text);
    setIntent("collect_contact_method");
    pushBot("Best way to follow up?");
  }

  function handleContactMethodPick(method: string) {
    setContactMethod(method);
    setIntent("handoff");

    // Soft, not pushy: contact form first; deposit is optional mention.
    const contactLink = buildContactLink(service, businessType, method);

    pushBot(
      `Perfect. I can help.\n\n**Next step:** use the Project Request form so I can reply with a clear quote + timeline.\n\n👉 ${contactLink}\n\nIf it makes sense after we confirm details, I’ll send you the right deposit link to secure your spot.`
    );
  }

  function handleSend(text: string) {
    const raw = text.trim();
    if (!raw) return;

    pushUser(raw);

    // 1) If we’re mid-flow, route answers accordingly
    if (intent === "collect_business_type") {
      handleBusinessType(raw);
      return;
    }

    if (intent === "idle") {
      // 2) Try FAQ match first
      const faq = matchFAQ(raw);
      if (faq) {
        pushBot(`**${faq.q}**\n\n${faq.a}\n\nWant me to help you start a project?`);
        // After FAQ response, offer buttons (but don’t force)
        setIntent("choose_service");
        pushBot("If you want, pick what you need:");
        return;
      }

      // 3) No FAQ match => start guided flow
      startGuidedFlow();
      return;
    }

    // If they typed while choosing service, try to infer quickly
    if (intent === "choose_service") {
      const t = normalize(raw);
      if (includesAny(t, ["website", "site", "web"])) return handleServicePick("website");
      if (includesAny(t, ["flyer", "flyers", "social", "instagram", "facebook", "promo", "posts"])) return handleServicePick("flyers_social");
      if (includesAny(t, ["ai", "automation", "templates", "chatbot"])) return handleServicePick("ai_setup");
      // If unclear, ask again
      pushBot("Which one is closest?");
      return;
    }

    // If they typed contact method instead of clicking
    if (intent === "collect_contact_method") {
      const t = normalize(raw);
      if (t.includes("email")) return handleContactMethodPick("Email");
      if (t.includes("text")) return handleContactMethodPick("Text");
      if (t.includes("call") || t.includes("phone")) return handleContactMethodPick("Phone Call");
      pushBot("Pick one: Email, Text, or Phone Call.");
      return;
    }

    // default
    startGuidedFlow();
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-[var(--navy)] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
        >
          Chat with JG →
        </button>
      ) : (
        <div className="w-[340px] max-w-[92vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[var(--navy)] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-black">JG Helper</p>
              <p className="text-xs text-white/80">Quick answers + project requests</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>

          <div ref={listRef} className="h-[360px] overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "bot"
                    ? "bg-slate-100 text-slate-900"
                    : "bg-[var(--gold)]/25 text-slate-900 ml-10"
                }`}
              >
                {/* simple markdown-ish bold */}
                {m.text.split("\n").map((line, i) => (
                  <p key={i} className={i === 0 ? "" : "mt-2"}>
                    {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                  </p>
                ))}
              </div>
            ))}

            {/* Buttons */}
            {suggestedButtons && (
              <div className="pt-1 space-y-2">
                {intent === "choose_service" &&
                  (suggestedButtons as { label: string; value: ServiceKey }[]).map((b) => (
                    <button
                      key={b.value}
                      onClick={() => handleServicePick(b.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                    >
                      {b.label} →
                    </button>
                  ))}

                {intent === "collect_contact_method" &&
                  (suggestedButtons as { label: string; value: string }[]).map((b) => (
                    <button
                      key={b.value}
                      onClick={() => handleContactMethodPick(b.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-left text-sm font-semibold hover:bg-slate-50"
                    >
                      {b.label} →
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
                setInput("");
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a question…"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--navy)]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Send
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      role: "bot",
                      text:
                        "Hey — I’m the JG Creative Studio helper.\n\nAsk a quick question, or tap a button and I’ll guide you.",
                    },
                  ]);
                  setIntent("idle");
                  setService("unknown");
                  setBusinessType("");
                  setContactMethod("");
                }}
                className="hover:underline"
              >
                Reset
              </button>
              <a className="hover:underline" href={CONTACT_URL}>
                Contact page
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}