export const metadata = {
    title: "FAQ",
    };export default function FAQPage() {
    return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
    <section className="mx-auto max-w-6xl px-6 py-16 space-y-10">
    <header className="space-y-3">
    <h1 className="text-4xl font-black">FAQ</h1>
    <p className="text-slate-600 text-lg max-w-3xl">
    Quick answers to the most common questions — if you don’t see yours,
    just hit the contact page and ask.
    </p>
    </header>
    
    <div className="grid gap-6 lg:grid-cols-2">
    <FAQItem
    q="How fast can you build a website?"
    a="Most simple sites take 3–7 days depending on how many pages and how quickly you can send your info (logo, services, photos, etc.)."
    />
    <FAQItem
    q="What do you need from me to get started?"
    a="Business name, what you offer, your contact info, and any photos/logos you have. If you don’t have photos, we can still launch clean and add later."
    />
    <FAQItem
    q="Do you do monthly updates and maintenance?"
    a="Yes. If you want ongoing updates (new offers, text changes, photo swaps, etc.) we can do a monthly plan so you’re not stuck trying to edit things yourself."
    />
    <FAQItem
    q="Can you redesign my current website?"
    a="Yes. If your site looks outdated or is hard to use on mobile, I can rebuild it with a modern layout and clearer messaging."
    />
    <FAQItem
    q="Do you offer flyers and social media too?"
    a="Yes. Flyers, promos, and social graphics that are sized correctly for Facebook/Instagram and match your brand style."
    />
    <FAQItem
    q="What are AI templates and how do they help?"
    a="They’re reusable message/workflow templates that help you respond faster, write captions, send review requests, and stay consistent without thinking about it every time."
    />
    <FAQItem
    q="Do you handle hosting and deployment?"
    a="Yes. I can deploy your site and make sure it’s live and working. If you want a custom domain, I can help set that up too."
    />
    <FAQItem
    q="What if I’m not sure what I need?"
    a="Totally fine. Tell me your business and what you’re trying to improve — I’ll recommend the simplest option that gets results."
    />
    </div>
    
    <section className="rounded-3xl bg-[var(--navy)] text-white p-10 text-center">
    <h2 className="text-3xl font-black">Still have questions?</h2>
    <p className="mt-3 text-white/80 max-w-2xl mx-auto">
    Send a message with what you do and what you want to improve — I’ll point
    you in the right direction.
    </p>
    <a
    href="/contact"
    className="mt-6 inline-block rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
    >
    Contact Me →
    </a>
    </section>
    </section>
    </main>
    );
    }
    
    function FAQItem({ q, a }: { q: string; a: string }) {
    return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
    <h3 className="text-lg font-black">{q}</h3>
    <p className="mt-2 text-slate-600 leading-relaxed">{a}</p>
    </div>
    );
    }
    