"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Mode = "faq" | "intake";
type Role = "bot" | "user";

type Message = {
id: string;
role: Role;
text: string;
};

type IntakeService =
| "website"
| "flyers"
| "ai"
| "not_sure"
| null;

type FollowUpMethod = "email" | "phone" | null;

type IntakeData = {
service: IntakeService;
websiteType: "one_page" | "multi_page" | "store" | "not_sure" | null;
promoType: "flyer" | "social_pack" | "both" | "not_sure" | null;
aiGoal:
| "faster_replies"
| "better_marketing"
| "reviews_followups"
| "automating_tasks"
| "not_sure"
| null;
aiWhere:
| "text_phone"
| "email"
| "social"
| "website"
| "not_sure"
| null;
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

// soft flags
proNoteShown: boolean;
};

type QuickReply = {
label: string;
onClick: () => void;
};

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

const FAQ = [
{
q: "How fast can you build a website?",
a: "Most simple sites take 3–7 days depending on pages and how quickly you can send info (logo, services, photos, etc.).",
},
{
q: "What do you need from me to get started?",
a: "Business name, what you offer, contact info, and any photos/logos you have. If you don’t have photos, we can still launch clean and add later.",
},
{
q: "Do you do monthly updates and maintenance?",
a: "Yes. If you want ongoing updates (new offers, text changes, photo swaps, etc.), we can do a monthly plan so you’re not stuck editing things yourself.",
},
{
q: "Can you redesign my current website?",
a: "Yes. If your site looks outdated or is hard to use on mobile, I can rebuild it with a modern layout and clearer messaging.",
},
{
q: "Do you offer flyers and social media too?",
a: "Yes — flyers, promos, and social graphics sized correctly for Facebook/Instagram and matched to your style.",
},
{
q: "What are AI templates and how do they help?",
a: "Reusable scripts/workflows that help you respond faster, write captions, send follow-ups, and stay consistent without thinking about it every time.",
},
{
q: "Do you handle hosting and deployment?",
a: "Yes — I can deploy your site and make sure it’s live and working. If you want a custom domain, I can help set that up too.",
},
{
q: "What if I’m not sure what I need?",
a: "Totally fine. Tell me your business and what you’re trying to improve — I’ll recommend the simplest option that gets results.",
},
];

const CONTACT_FORM_URL = "/contact";

function buildContactUrl(data: IntakeData) {
// Map intake to your Contact page <select> options (these must match your <option> labels)
let serviceLabel = "Not sure yet";

if (data.service === "website") serviceLabel = "Website Creation";
if (data.service === "flyers") {
if (data.promoType === "flyer") serviceLabel = "Flyer / Promo Design";
else if (data.promoType === "social_pack") serviceLabel = "Social Media Posts";
else if (data.promoType === "both") serviceLabel = "Flyer / Promo Design"; // default to flyer; you can tweak later
else serviceLabel = "Not sure yet";
}
if (data.service === "ai") serviceLabel = "AI Template Setup";

const params = new URLSearchParams();

// These are NEW fields we will eventually add to your form.
// It won't break anything if they don’t exist yet.
if (serviceLabel) params.set("service", serviceLabel);
if (data.businessType) params.set("business_type", data.businessType);
if (data.goal) params.set("goal", data.goal);

if (data.followUp) params.set("preferred_contact", data.followUp);
if (data.email) params.set("email", data.email);
if (data.phone) params.set("phone", data.phone);

// Extra notes bundle (so you still capture info even before adding extra fields)
const notesParts: string[] = [];
if (data.service === "website") {
if (data.websiteType) notesParts.push(`Website type: ${data.websiteType}`);
if (data.domainHave) notesParts.push(`Has domain: ${data.domainHave}`);
if (data.domainValue) notesParts.push(`Domain: ${data.domainValue}`);
}
if (data.service === "flyers") {
if (data.promoType) notesParts.push(`Promo type: ${data.promoType}`);
if (data.promoWhat) notesParts.push(`Promoting: ${data.promoWhat}`);
if (data.promoAssets) notesParts.push(`Has assets: ${data.promoAssets}`);
if (data.promoDeadline) notesParts.push(`Deadline: ${data.promoDeadline}`);
}
if (data.service === "ai") {
if (data.aiGoal) notesParts.push(`AI goal: ${data.aiGoal}`);
if (data.aiWhere) notesParts.push(`Where: ${data.aiWhere}`);
if (data.aiSetupType) notesParts.push(`Setup type: ${data.aiSetupType}`);
}

if (notesParts.length) params.set("notes_from_chatbot", notesParts.join(" | "));

const qs = params.toString();
return qs ? `${CONTACT_FORM_URL}?${qs}` : CONTACT_FORM_URL;
}

function prettyWebsiteType(v: IntakeData["websiteType"]) {
if (v === "one_page") return "One-page site";
if (v === "multi_page") return "Multi-page business site";
if (v === "store") return "Online store";
if (v === "not_sure") return "Not sure yet";
return "";
}

function prettyPromoType(v: IntakeData["promoType"]) {
if (v === "flyer") return "Flyer / promo";
if (v === "social_pack") return "Social media post pack";
if (v === "both") return "Both";
if (v === "not_sure") return "Not sure yet";
return "";
}

function prettyAiGoal(v: IntakeData["aiGoal"]) {
if (v === "faster_replies") return "Faster replies to customers";
if (v === "better_marketing") return "Better marketing / captions";
if (v === "reviews_followups") return "Review requests / follow-ups";
if (v === "automating_tasks") return "Automating tasks";
if (v === "not_sure") return "Not sure yet";
return "";
}

function prettyAiWhere(v: IntakeData["aiWhere"]) {
if (v === "text_phone") return "Text / Phone";
if (v === "email") return "Email";
if (v === "social") return "Instagram / Facebook";
if (v === "website") return "Website";
if (v === "not_sure") return "Not sure yet";
return "";
}

function prettyAiSetup(v: IntakeData["aiSetupType"]) {
if (v === "basic") return "Basic templates (quick setup)";
if (v === "pro") return "Pro automation (custom workflows)";
if (v === "not_sure") return "Not sure yet";
return "";
}

export default function JGChatWidget() {
const [open, setOpen] = useState(false);
const [mode, setMode] = useState<Mode>("intake");

const [messages, setMessages] = useState<Message[]>([]);
const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
const [expectingInput, setExpectingInput] = useState<null | "business" | "domain" | "promoWhat" | "goal" | "email" | "phone">(null);
const [inputValue, setInputValue] = useState("");

const [intake, setIntake] = useState<IntakeData>({
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

proNoteShown: false,
});

const scrollRef = useRef<HTMLDivElement | null>(null);

useEffect(() => {
if (!open) return;
const t = setTimeout(() => {
scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
}, 50);
return () => clearTimeout(t);
}, [open, messages.length]);

// Helpers
const botSay = (text: string) =>
setMessages((m) => [...m, { id: uid(), role: "bot", text }]);

const userSay = (text: string) =>
setMessages((m) => [...m, { id: uid(), role: "user", text }]);

const resetIntake = () => {
setIntake({
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

proNoteShown: false,
});
};

const start = (m: Mode) => {
setMode(m);
setMessages([]);
setQuickReplies([]);
setExpectingInput(null);
setInputValue("");
if (m === "faq") startFAQ();
else startIntake();
};

// Start up on first open
useEffect(() => {
if (!open) return;
if (messages.length === 0) start(mode);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open]);

// MODE A — FAQ
const startFAQ = () => {
botSay("Quick answers — tap a question below, or switch to “Start a project” to get a quote.");
setQuickReplies(
FAQ.slice(0, 6).map((item) => ({
label: item.q,
onClick: () => {
userSay(item.q);
botSay(item.a);
setQuickReplies((prev) => [
...prev,
{ label: "Ask another question", onClick: () => startFAQ() },
{ label: "Start a project", onClick: () => start("intake") },
]);
},
}))
);
};

// MODE B — Intake
const startIntake = () => {
resetIntake();
botSay("Hey — I’m the JG assistant. What are you looking for help with?");
setQuickReplies([
{ label: "Website", onClick: () => pickService("website") },
{ label: "Flyers / Social", onClick: () => pickService("flyers") },
{ label: "AI Setup", onClick: () => pickService("ai") },
{ label: "Not sure yet", onClick: () => pickService("not_sure") },
]);
};

const pickService = (service: IntakeService) => {
userSay(
service === "website"
? "Website"
: service === "flyers"
? "Flyers / Social"
: service === "ai"
? "AI Setup"
: "Not sure yet"
);
setIntake((d) => ({ ...d, service }));

if (service === "website") {
botSay("Perfect — websites are one of my main services. What type of site are you thinking?");
setQuickReplies([
{ label: "One-page site", onClick: () => setWebsiteType("one_page") },
{ label: "Multi-page business site", onClick: () => setWebsiteType("multi_page") },
{ label: "Online store", onClick: () => setWebsiteType("store") },
{ label: "Not sure yet", onClick: () => setWebsiteType("not_sure") },
]);
return;
}

if (service === "flyers") {
botSay("Perfect — promos are usually the fastest way to boost business. What do you need?");
setQuickReplies([
{ label: "Flyer / promo", onClick: () => setPromoType("flyer") },
{ label: "Social media post pack", onClick: () => setPromoType("social_pack") },
{ label: "Both", onClick: () => setPromoType("both") },
{ label: "Not sure yet", onClick: () => setPromoType("not_sure") },
]);
return;
}

if (service === "ai") {
botSay("Love it — AI setups can save a ton of time. What are you trying to improve?");
setQuickReplies([
{ label: "Faster replies to customers", onClick: () => setAiGoal("faster_replies") },
{ label: "Better marketing / captions", onClick: () => setAiGoal("better_marketing") },
{ label: "Review requests / follow-ups", onClick: () => setAiGoal("reviews_followups") },
{ label: "Automating tasks", onClick: () => setAiGoal("automating_tasks") },
{ label: "Not sure yet", onClick: () => setAiGoal("not_sure") },
]);
return;
}

// not sure
botSay("Totally fine — what are you trying to improve most?");
setQuickReplies([
{ label: "Get more customers", onClick: () => notSurePickGoal("Get more customers") },
{ label: "Look more professional", onClick: () => notSurePickGoal("Look more professional") },
{ label: "Promote an offer", onClick: () => notSurePickGoal("Promote an offer") },
{ label: "Save time / automate", onClick: () => notSurePickGoal("Save time / automate") },
{ label: "Not sure", onClick: () => notSurePickGoal("Not sure") },
]);
};

const setWebsiteType = (t: IntakeData["websiteType"]) => {
userSay(prettyWebsiteType(t));
setIntake((d) => ({ ...d, websiteType: t }));
botSay("Nice. What type of business is this for?");
setQuickReplies([]);
setExpectingInput("business");
};

const setPromoType = (t: IntakeData["promoType"]) => {
userSay(prettyPromoType(t));
setIntake((d) => ({ ...d, promoType: t }));
botSay("What are you promoting? (Example: event, special deal, menu, grand opening, etc.)");
setQuickReplies([]);
setExpectingInput("promoWhat");
};

const setAiGoal = (g: IntakeData["aiGoal"]) => {
userSay(prettyAiGoal(g));
setIntake((d) => ({ ...d, aiGoal: g }));
botSay("Where do you want the AI help to happen?");
setQuickReplies([
{ label: "Text / Phone", onClick: () => setAiWhere("text_phone") },
{ label: "Email", onClick: () => setAiWhere("email") },
{ label: "Instagram / Facebook", onClick: () => setAiWhere("social") },
{ label: "Website", onClick: () => setAiWhere("website") },
{ label: "Not sure yet", onClick: () => setAiWhere("not_sure") },
]);
};

const setAiWhere = (w: IntakeData["aiWhere"]) => {
userSay(prettyAiWhere(w));
setIntake((d) => ({ ...d, aiWhere: w }));
botSay("What kind of AI setup are you looking for?");
setQuickReplies([
{ label: "Basic templates (quick setup)", onClick: () => setAiSetupType("basic") },
{ label: "Pro automation (custom workflows)", onClick: () => setAiSetupType("pro") },
{ label: "Not sure yet", onClick: () => setAiSetupType("not_sure") },
]);
};

const setAiSetupType = (t: IntakeData["aiSetupType"]) => {
userSay(prettyAiSetup(t));
setIntake((d) => ({ ...d, aiSetupType: t }));

botSay("What type of business is this for?");
setQuickReplies([]);
setExpectingInput("business");
};

const notSurePickGoal = (g: string) => {
userSay(g);
setIntake((d) => ({ ...d, goal: d.goal || g }));
botSay("Got it. What type of business do you run?");
setQuickReplies([]);
setExpectingInput("business");
};

const afterBusinessType = (businessType: string) => {
const service = intake.service;

if (service === "website") {
botSay("Do you already have a domain name?");
setQuickReplies([
{ label: "Yes", onClick: () => setDomainHave("yes") },
{ label: "No", onClick: () => setDomainHave("no") },
{ label: "Not sure", onClick: () => setDomainHave("not_sure") },
]);
return;
}

if (service === "flyers") {
botSay("Do you already have a logo, photos, or brand colors you want included?");
setQuickReplies([
{ label: "Yes", onClick: () => setPromoAssets("yes") },
{ label: "No", onClick: () => setPromoAssets("no") },
{ label: "Some of it", onClick: () => setPromoAssets("some") },
]);
return;
}

if (service === "ai") {
// Optional gentle pro note later — not pushy.
botSay("What’s the biggest thing you want AI to help you do? (Examples: respond faster, book more clients, send follow-ups, stay organized.)");
setQuickReplies([]);
setExpectingInput("goal");
return;
}

// not sure
botSay("What’s the main goal right now? (More calls, bookings, credibility, promote a deal, etc.)");
setQuickReplies([]);
setExpectingInput("goal");
};

const setDomainHave = (v: IntakeData["domainHave"]) => {
userSay(v === "yes" ? "Yes" : v === "no" ? "No" : "Not sure");
setIntake((d) => ({ ...d, domainHave: v }));

if (v === "yes") {
botSay("Great — what’s the domain? (Example: mybusiness.com)");
setQuickReplies([]);
setExpectingInput("domain");
return;
}

botSay("No problem — I can help you pick one and set it up later.");
botSay("What’s the main goal of the website? (More calls, bookings, credibility, showcase services, sell something, etc.)");
setQuickReplies([]);
setExpectingInput("goal");
};

const setPromoAssets = (v: IntakeData["promoAssets"]) => {
userSay(v === "yes" ? "Yes" : v === "no" ? "No" : "Some of it");
setIntake((d) => ({ ...d, promoAssets: v }));

botSay("When do you need it by?");
setQuickReplies([
{ label: "ASAP", onClick: () => setPromoDeadline("asap") },
{ label: "Within a few days", onClick: () => setPromoDeadline("few_days") },
{ label: "Next week", onClick: () => setPromoDeadline("next_week") },
{ label: "No rush", onClick: () => setPromoDeadline("no_rush") },
]);
};

const setPromoDeadline = (v: IntakeData["promoDeadline"]) => {
userSay(
v === "asap"
? "ASAP"
: v === "few_days"
? "Within a few days"
: v === "next_week"
? "Next week"
: "No rush"
);
setIntake((d) => ({ ...d, promoDeadline: v }));

botSay("What’s the goal? (More calls, more customers in-store, promote a deal, more followers, etc.)");
setQuickReplies([]);
setExpectingInput("goal");
};

const afterGoal = () => {
// If AI + pro setup: gentle note (not pushy) ONCE
if (
intake.service === "ai" &&
intake.aiSetupType === "pro" &&
!intake.proNoteShown
) {
setIntake((d) => ({ ...d, proNoteShown: true }));
botSay("Quick note — advanced AI setups are usually custom-built, so I’ll confirm scope first. If you decide to move forward, you can lock in your spot with a deposit later (optional).");
}

botSay("Best way to follow up with you?");
setQuickReplies([
{ label: "Email", onClick: () => pickFollowUp("email") },
{ label: "Phone / Text", onClick: () => pickFollowUp("phone") },
]);
};

const pickFollowUp = (m: FollowUpMethod) => {
userSay(m === "email" ? "Email" : "Phone / Text");
setIntake((d) => ({ ...d, followUp: m }));
setQuickReplies([]);

if (m === "email") {
botSay("What’s the best email to reach you?");
setExpectingInput("email");
return;
}

botSay("What’s the best phone number to text/call you? (optional)");
setExpectingInput("phone");
};

const finishAndHandoff = () => {
botSay("Awesome — I can definitely help with that.");
botSay("Want to send this through so I can reply with a clear quote + timeline?");
setQuickReplies([
{
label: "Open Project Request Form",
onClick: () => {
const url = buildContactUrl(intake);
window.location.href = url;
},
},
{
    label: "Email James directly",
    onClick: () => {
      const subject = encodeURIComponent(
        "New inquiry from JG Creative Studio website"
      );
  
      const body = encodeURIComponent(
        `Hi James,
  
  I was chatting with your website assistant and wanted to reach out directly.
  
  Service needed:
  ${intake.service || "Not specified"}
  
  Business type:
  ${intake.businessType || "Not specified"}
  
  Goal:
  ${intake.goal || "Not specified"}
  
  Preferred follow-up:
  ${intake.followUp || "Not specified"}
  
  Email:
  ${intake.email || "Not provided"}
  
  Phone:
  ${intake.phone || "Not provided"}
  
  Thanks!
  `
      );
  
      window.location.href = `mailto:hello@jgcreativestudios.com?subject=${subject}&body=${body}`;
    },
  },
]);
};

const handleSubmitInput = () => {
const v = inputValue.trim();
if (!v) return;

if (expectingInput === "business") {
userSay(v);
setIntake((d) => ({ ...d, businessType: v }));
setInputValue("");
setExpectingInput(null);
afterBusinessType(v);
return;
}

if (expectingInput === "promoWhat") {
userSay(v);
setIntake((d) => ({ ...d, promoWhat: v }));
setInputValue("");
setExpectingInput(null);

botSay("What type of business is this for?");
setExpectingInput("business");
return;
}

if (expectingInput === "domain") {
userSay(v);
setIntake((d) => ({ ...d, domainValue: v }));
setInputValue("");
setExpectingInput(null);

botSay("What’s the main goal of the website? (More calls, bookings, credibility, showcase services, sell something, etc.)");
setExpectingInput("goal");
return;
}

if (expectingInput === "goal") {
userSay(v);
setIntake((d) => ({ ...d, goal: v }));
setInputValue("");
setExpectingInput(null);

afterGoal();
return;
}

if (expectingInput === "email") {
userSay(v);
setIntake((d) => ({ ...d, email: v }));
setInputValue("");
setExpectingInput(null);

finishAndHandoff();
return;
}

if (expectingInput === "phone") {
userSay(v);
setIntake((d) => ({ ...d, phone: v }));
setInputValue("");
setExpectingInput(null);

// If phone was chosen, we still might want email optionally later,
// but we’ll keep it simple and finish.
finishAndHandoff();
return;
}
};

// UI helpers
const headerTitle = mode === "faq" ? "Quick Answers" : "Start a Project";
const switchLabel = mode === "faq" ? "Start a project" : "Quick answers";

const showInput = expectingInput !== null;

return (
<>
{/* Floating button */}
<button
onClick={() => setOpen((v) => !v)}
className="fixed bottom-5 right-5 z-50 rounded-full bg-[var(--navy)] text-white shadow-lg hover:opacity-95 active:scale-[0.99]"
style={{ width: 56, height: 56 }}
aria-label="Open chat"
>
<span className="text-xl">💬</span>
</button>

{/* Panel */}
{open ? (
<div className="fixed bottom-20 right-5 z-50 w-[92vw] max-w-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
{/* Header */}
<div className="flex items-center justify-between gap-3 bg-[var(--navy)] px-4 py-3 text-white">
<div className="min-w-0">
<p className="text-sm font-semibold text-white/80">JG Assistant</p>
<p className="truncate text-base font-black">{headerTitle}</p>
</div>

<div className="flex items-center gap-2">
<button
onClick={() => start(mode === "faq" ? "intake" : "faq")}
className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/15"
>
{switchLabel}
</button>
<button
onClick={() => setOpen(false)}
className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/15"
>
Close
</button>
</div>
</div>

{/* Messages */}
<div
ref={scrollRef}
className="max-h-[55vh] space-y-3 overflow-y-auto px-4 py-4"
>
{messages.length === 0 ? (
<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
Loading…
</div>
) : null}

{messages.map((m) => (
<div
key={m.id}
className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
>
<div
className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
m.role === "user"
? "bg-[var(--navy)] text-white"
: "bg-slate-50 text-slate-800 border border-slate-200"
}`}
>
{m.text}
</div>
</div>
))}

{/* Quick replies */}
{quickReplies.length > 0 ? (
<div className="pt-1">
<div className="flex flex-wrap gap-2">
{quickReplies.map((q) => (
<button
key={q.label}
onClick={q.onClick}
className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
>
{q.label}
</button>
))}
</div>
</div>
) : null}

{/* Input */}
{showInput ? (
<div className="pt-2">
<div className="flex gap-2">
<input
value={inputValue}
onChange={(e) => setInputValue(e.target.value)}
onKeyDown={(e) => {
if (e.key === "Enter") handleSubmitInput();
}}
placeholder={
expectingInput === "business"
? "Type your business type…"
: expectingInput === "domain"
? "Type your domain…"
: expectingInput === "promoWhat"
? "What are you promoting?"
: expectingInput === "goal"
? "Type your goal…"
: expectingInput === "email"
? "Type your email…"
: "Type your phone…"
}
className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
/>
<button
onClick={handleSubmitInput}
className="rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-black text-[var(--navy)] hover:opacity-95"
>
Send
</button>
</div>

<div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
<button
onClick={() => start("intake")}
className="hover:underline"
>
Restart
</button>
<Link href="/contact" className="hover:underline">
Go to Contact
</Link>
</div>
</div>
) : (
<div className="pt-2 text-[11px] text-slate-500">
Tip: you can switch modes anytime up top.
</div>
)}
</div>
</div>
) : null}
</>
);
}

/**
* Compatibility export:
* If your layout still imports `ChatWidget` somewhere, this prevents breakage.
* You can remove this later once everything is standardized.
*/
export const ChatWidget = JGChatWidget;
