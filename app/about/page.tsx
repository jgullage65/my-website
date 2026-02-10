// app/about/page.tsx

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <header className="grid gap-10 lg:grid-cols-[280px_1fr] lg:items-center">
          {/* Photo */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative">
              <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://i.postimg.cc/X7yd2PHq/9596D79E-9880-4FC7-9AD1-F44BDCDF2544-(1).jpg"
                  alt="James Gullage"
                  className="h-[280px] w-[240px] rounded-2xl object-cover border border-slate-200"
                />
              </div>

              <div className="mt-4 text-center lg:text-left">
                <p className="text-sm font-semibold text-slate-700">
                  James Gullage
                </p>
                <p className="text-sm text-slate-500">
                  Founder, JG Creative Studio, LLC
                </p>
              </div>
            </div>
          </div>

          {/* Intro */}
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-wide text-[var(--navy)]">
              ABOUT
            </p>

            {/* ✅ Main headline (bigger + cleaner) */}
            <h1 className="text-4xl sm:text-5xl font-black leading-tight">
              About JG Creative Studio
            </h1>

            {/* ✅ Supporting paragraph (uses your old headline idea, but cleaner) */}
            <p className="text-lg text-slate-600 max-w-2xl">
              I help small businesses look professional, attract customers, and
              simplify their online presence through clean websites, clear
              marketing materials, and practical AI-powered systems.
            </p>

            {/* Personal note (still included, but no longer the first thing people see) */}
            <p className="text-slate-600 max-w-2xl">
              I’m 34 years old, a stay-at-home dad, and I’m passionate about
              coding, AI, sports, family, and helping people understand
              technology without the confusion.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Tag>Websites</Tag>
              <Tag>Flyers + Social</Tag>
              <Tag>AI Templates</Tag>
              <Tag>Simple Systems</Tag>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--navy)] px-6 py-3 font-semibold text-white hover:opacity-90"
              >
                Contact Me →
              </a>

              <a
                href="/services"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-100"
              >
                View Services
              </a>
            </div>
          </div>
        </header>

        {/* Info Cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <InfoCard
            title="My focus"
            body="Simple, professional work that’s easy for clients to understand — no tech overwhelm."
          />
          <InfoCard
            title="How I work"
            body="Fast turnaround, clear communication, and a clean process from start to finish."
          />
          <InfoCard
            title="What you get"
            body="A modern look, organized layout, and content that helps customers take action."
          />
        </div>

        {/* Story */}
        <section className="mt-14 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h2 className="text-2xl font-black">
            Why I started JG Creative Studio
          </h2>

          <p className="mt-3 text-slate-600 max-w-4xl">
            A lot of businesses provide amazing services — but their website,
            flyers, or online presence doesn’t match the quality of what they do.
            I started JG Creative Studio to help fix that with clean design,
            easy-to-navigate websites, and practical AI templates that save time.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <MiniPoint
              title="Modern design"
              desc="Looks clean, current, and trustworthy on mobile."
            />
            <MiniPoint
              title="Simple messaging"
              desc="Clear words that customers actually understand."
            />
            <MiniPoint
              title="Real support"
              desc="Help after launch with updates and maintenance."
            />
          </div>

          <div className="mt-10 rounded-2xl bg-[var(--navy)] p-8 text-white">
            <h3 className="text-xl font-black">Want help with your business?</h3>
            <p className="mt-2 text-white/80 max-w-2xl">
              Tell me what you do and what you want to improve — I’ll recommend
              the simplest path to get you a clean, professional presence.
            </p>

            <a
              href="/contact"
              className="mt-5 inline-block rounded-xl bg-[var(--gold)] px-7 py-3 font-semibold text-[var(--navy)] hover:opacity-90"
            >
              Let’s Talk →
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

/* Components */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
      {children}
    </span>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-2 text-slate-600">{body}</p>
    </div>
  );
}

function MiniPoint({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <p className="text-sm font-semibold text-[var(--navy)]">• {title}</p>
      <p className="mt-2 text-slate-700">{desc}</p>
    </div>
  );
}