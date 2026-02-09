import { NextResponse } from "next/server";

type ChatRequest = {
message: string;
};

function normalize(text: string) {
return text.toLowerCase().trim();
}

export async function POST(req: Request) {
try {
const body = (await req.json()) as ChatRequest;

const msg = normalize(body.message || "");

let reply = "";

// BASIC FLOW KEYWORDS
const wantsWebsite =
msg.includes("website") ||
msg.includes("site") ||
msg.includes("web") ||
msg.includes("landing");

const wantsFlyers =
msg.includes("flyer") ||
msg.includes("flyers") ||
msg.includes("social") ||
msg.includes("instagram") ||
msg.includes("facebook") ||
msg.includes("post");

const wantsAI =
msg.includes("ai") ||
msg.includes("automation") ||
msg.includes("chatbot") ||
msg.includes("templates") ||
msg.includes("prompt");

const mentionsBusinessType =
msg.includes("shop") ||
msg.includes("business") ||
msg.includes("company") ||
msg.includes("restaurant") ||
msg.includes("salon") ||
msg.includes("barber") ||
msg.includes("cleaning") ||
msg.includes("plumbing") ||
msg.includes("construction") ||
msg.includes("real estate");

const mentionsFollowUp =
msg.includes("@") ||
msg.includes("email") ||
msg.includes("text") ||
msg.includes("call") ||
msg.includes("phone") ||
msg.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/);

// START RESPONSE
if (
msg === "hi" ||
msg === "hello" ||
msg === "hey" ||
msg.includes("what do you do") ||
msg.includes("help")
) {
reply = `Hey! 👋 I’m the JG Creative Studio assistant.

What are you looking for help with today?

• Website
• Flyers / Social Media
• AI Setup`;
}

// WEBSITE PATH
else if (wantsWebsite) {
reply = `Awesome — happy to help with a website. 🔥

Quick question:

Are you thinking:
• Simple one-page website
• Multi-page business website?`;
}

// FLYERS / SOCIAL PATH
else if (wantsFlyers) {
reply = `Nice — flyers and social content are a great way to get customers fast. 💪

Quick question:

What do you need most right now?

• Flyer (promo / event / deal)
• Social Media Post Pack
• Both`;
}

// AI PATH
else if (wantsAI) {
reply = `Love it — AI setups are one of the best ways to save time. 🤖🔥

Quick question:

What do you want AI help with?

• Customer reply templates
• Quote / intake automation
• Content ideas (posts, captions, ads)
• A custom chatbot for your website`;
}

// BUSINESS TYPE QUESTION
else if (mentionsBusinessType) {
reply = `Perfect — that sounds like a great fit. 🔥

Last quick question so I can follow up properly:

What’s the best way to reach you?

• Email
• Phone/Text

(After that, I’ll point you to the best next step — no pressure.)`;
}

// FOLLOW UP PROVIDED
else if (mentionsFollowUp) {
reply = `Awesome — got it. ✅

If you want the fastest next step, fill out the quick Project Form here:
👉 /contact

That gives me everything I need to quote you fast.

If you're ready to lock in a spot, deposits are available here:
👉 /payments

No rush though — message me anytime and I’ll help you pick the simplest option. 💪`;
}

// DEFAULT FALLBACK
else {
reply = `Got it 👍

To help you best, what are you looking for?

• Website
• Flyers / Social Media
• AI Setup`;
}

return NextResponse.json({ reply });
} catch (error) {
console.error("Chatbot error:", error);
return NextResponse.json(
{ reply: "Something went wrong. Please try again." },
{ status: 500 }
);
}
}