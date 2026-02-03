export const metadata = {
    title: "Examples",
    };export default function ExamplesPage() {
    return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
    <section className="mx-auto max-w-6xl px-6 py-16 space-y-14">
    {/* Header */}
    <header className="space-y-3">
    <h1 className="text-4xl font-black">Examples</h1>
    <p className="text-slate-600 text-lg max-w-3xl">
    A few sample designs and concepts that show what we can create for your
    business — clean, modern, and ready to post.
    </p>
    </header>
    
    {/* Flyer Examples */}
    <section className="space-y-6">
    <h2 className="text-3xl font-black">Flyer + Social Examples</h2>
    <p className="text-slate-600 max-w-3xl">
    Here are a couple sample promo design sets.
    </p>
    
    {/* ✅ Images only */}
    <div className="grid gap-6 lg:grid-cols-2">
    <ImageOnly url="https://i.postimg.cc/C51S6jMX/E40EE0C3-3041-41EB-8E02-B6C9FF99416E.jpg" />
    <ImageOnly url="https://i.postimg.cc/1zQPZx53/FE048F29-6FB8-4500-9C49-532FCD68D4FC.jpg" />
    </div>
    
    {/* CTA */}
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
    <h3 className="text-2xl font-black">Want designs like this?</h3>
    <p className="mt-2 text-slate-600">
    Tell me what kind of business you run and what you want to promote —
    I’ll create a matching style that’s ready to post.
    </p>
    
    <a
    href="/contact"
    className="mt-6 inline-block rounded-xl bg-[var(--navy)] px-8 py-3 font-semibold text-white hover:opacity-90"
    >
    Contact Me →
    </a>
    </div>
    </section>
    
    {/* Website Concepts */}
    <section className="space-y-6">
    <h2 className="text-3xl font-black">Sample Website Concepts</h2>
    <p className="text-slate-600 max-w-3xl">
    Websites don’t need to be complicated — they need to look trustworthy,
    work on mobile, and make it easy for customers to contact you.
    </p>
    
    <div className="grid gap-6 md:grid-cols-2">
    <WebsiteConcept
    title="Simple One-Page Website"
    desc="Perfect for a clean online presence with clear calls-to-action."
    items={["Hero + contact button", "Services overview", "Mobile friendly"]}
    />
    
    <WebsiteConcept
    title="Multi-Page Business Website"
    desc="Best for companies that want separate pages for services, pricing, and contact."
    items={["Home + Services + Pricing", "Lead form capture", "Professional navigation"]}
    />
    
    <WebsiteConcept
    title="Landing Page for Promotions"
    desc="Great for running ads or focusing on one offer."
    items={["High conversion layout", "Clear call-to-action", "Fast turnaround build"]}
    />
    
    <WebsiteConcept
    title="Ongoing Website Maintenance"
    desc="Keep your site updated with changes, promotions, and improvements."
    items={["Monthly edits + updates", "Fixes + improvements", "Support when needed"]}
    />
    </div>
    </section>
    
    {/* ✅ AI Template Examples */}
    <section className="space-y-6">
    <h2 className="text-3xl font-black">AI Template Examples</h2>
    <p className="text-slate-600 max-w-3xl">
    I also build simple AI-powered templates that help you save time, respond
    faster, and stay consistent with customers.
    </p>
    
    <div className="grid gap-6 md:grid-cols-2">
    <AIBox
    title="Customer Reply Templates"
    desc="Fast responses for DMs, quote requests, bookings, and FAQs."
    />
    
    <AIBox
    title="Social Media Caption Generator"
    desc="Quick post captions customized to your business style and offers."
    />
    
    <AIBox
    title="Review Request Scripts"
    desc="Automated messages that help you get more Google reviews."
    />
    
    <AIBox
    title="Business Workflow Helpers"
    desc="Simple AI setups to organize tasks, emails, or customer intake."
    />
    </div>
    
    {/* CTA */}
    <div className="rounded-3xl bg-[var(--navy)] text-white p-10 text-center">
    <h3 className="text-2xl font-black">
    Want AI templates built for your business?
    </h3>
    <p className="mt-3 text-white/80 max-w-2xl mx-auto">
    Tell me what tasks you repeat every week — I can build an AI workflow
    that saves you time instantly.
    </p>
    
    <a
    href="/contact"
    className="mt-6 inline-block rounded-xl bg-[var(--gold)] px-8 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
    >
    Ask About AI Help →
    </a>
    </div>
    </section>
    </section>
    </main>
    );
    }
    
    /* ✅ Image Only Box */
    function ImageOnly({ url }: { url: string }) {
    return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
    <img
    src={url}
    alt="Design sample collage"
    className="w-full rounded-2xl border border-slate-200"
    />
    </div>
    );
    }
    
    /* Website Concept Card */
    function WebsiteConcept({
    title,
    desc,
    items,
    }: {
    title: string;
    desc: string;
    items: string[];
    }) {
    return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
    <h3 className="text-xl font-black">{title}</h3>
    <p className="mt-2 text-slate-600">{desc}</p>
    
    <ul className="mt-4 space-y-2 text-sm text-slate-700">
    {items.map((item) => (
    <li key={item} className="flex gap-2">
    <span className="mt-[6px] h-2 w-2 rounded-full bg-[var(--gold)]" />
    {item}
    </li>
    ))}
    </ul>
    </div>
    );
    }
    
    /* ✅ AI Box */
    function AIBox({ title, desc }: { title: string; desc: string }) {
    return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
    <h3 className="text-xl font-black">{title}</h3>
    <p className="mt-2 text-slate-600">{desc}</p>
    </div>
    );
    }
    