import Link from "next/link";

export const metadata = {
  title: "Premium Websites & AI Systems",
  description:
    "JG Creative Studio builds premium websites, AI copilots, automation, and custom business systems.",
};

const services = [
  {
    number: "01",
    title: "Premium Websites",
    copy: "Custom websites built to make your business look established, explain your value clearly, and turn attention into action.",
    bullets: ["Custom responsive design", "Conversion-focused structure", "Strong mobile experience"],
  },
  {
    number: "02",
    title: "AI Business Systems",
    copy: "Purpose-built AI that helps your team answer faster, organize knowledge, support customers, and reduce repetitive work.",
    bullets: ["Custom copilots", "Support assistants", "AI workflow automation"],
  },
  {
    number: "03",
    title: "Custom Business Tools",
    copy: "Operational software built around the way your company actually works, from lead systems to dashboards and internal tools.",
    bullets: ["Dashboards", "Lead systems", "Internal software"],
  },
];

const capabilities = [
  "Premium SaaS interfaces",
  "AI copilots",
  "Lead intelligence",
  "Business dashboards",
  "Workflow automation",
  "Responsive websites",
];

const process = [
  ["01", "Understand", "We define the business, audience, bottleneck, and outcome before touching the design."],
  ["02", "Design", "We shape the right website, AI system, or custom tool around the real goal."],
  ["03", "Build", "We turn the plan into a polished, responsive product with clear structure and strong usability."],
  ["04", "Launch", "We ship cleanly, test the important paths, and support the next stage of improvement."],
];

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function CheckIcon() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.34)] bg-[rgba(212,175,55,0.1)] text-[10px] font-black text-[var(--gold)]">
      ✓
    </span>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      <section className="relative border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[8%] top-12 h-72 w-72 rounded-full bg-[rgba(245,158,11,0.13)] blur-[110px]" />
          <div className="absolute right-[6%] top-20 h-96 w-96 rounded-full bg-[rgba(212,175,55,0.08)] blur-[130px]" />
        </div>

        <div className="relative mx-auto grid min-h-[760px] w-full max-w-[96rem] items-center gap-14 px-6 py-20 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:px-10 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(212,175,55,0.28)] bg-[rgba(14,22,62,0.72)] px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--gold)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <span className="h-2 w-2 rounded-full bg-[var(--amber)] shadow-[0_0_18px_rgba(245,158,11,0.9)]" />
              JG Creative Studio
            </div>

            <h1 className="mt-7 max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl xl:text-[5.8rem]">
              Websites that look premium.
              <span className="mt-2 block bg-[linear-gradient(180deg,#f8fbff_12%,#d4af37_94%)] bg-clip-text text-transparent">
                AI systems that do real work.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
              We build custom websites, AI copilots, automation, and business tools for companies that need more than another template.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-7 py-4 text-sm font-black text-[#07101f] shadow-[0_18px_46px_rgba(212,175,55,0.24),inset_0_1px_0_rgba(255,255,255,0.42)] transition duration-200 hover:-translate-y-0.5"
              >
                Start a Project <ArrowIcon />
              </Link>
              <Link
                href="#leadforge"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(212,175,55,0.28)] bg-[linear-gradient(180deg,rgba(17,27,72,0.9),rgba(7,12,31,0.94))] px-7 py-4 text-sm font-black text-white shadow-[0_18px_44px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(245,158,11,0.55)]"
              >
                See LEADFORGE <ArrowIcon />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-slate-300">
              <span>Custom-built</span>
              <span className="text-[var(--gold)]">•</span>
              <span>Mobile-ready</span>
              <span className="text-[var(--gold)]">•</span>
              <span>Business-first</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-[rgba(245,158,11,0.11)] blur-[90px]" />
            <div className="relative rounded-[2rem] border border-[rgba(212,175,55,0.28)] bg-[linear-gradient(145deg,rgba(16,24,58,0.97),rgba(5,9,24,0.98))] p-4 shadow-[0_42px_110px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-6">
              <div className="rounded-[1.55rem] border border-white/[0.07] bg-[#070d20] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Business System</p>
                    <p className="mt-2 text-2xl font-black text-white">AI Growth Console</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                    Active
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {["Qualified Leads", "AI Actions", "Response Time", "Opportunities"].map((label, index) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                      <p className="mt-3 text-3xl font-black text-white">{[128, 346, "2.4m", 18][index]}</p>
                      <div className="mt-4 h-1.5 rounded-full bg-white/[0.07]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#d4af37,#f59e0b)]"
                          style={{ width: `${[82, 91, 68, 76][index]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-[rgba(212,175,55,0.16)] bg-[linear-gradient(180deg,rgba(14,22,62,0.8),rgba(7,12,31,0.9))] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">Recommended action</p>
                      <p className="mt-2 font-black text-white">Follow up with high-intent opportunities first.</p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] font-black text-[#07101f] shadow-[0_12px_26px_rgba(212,175,55,0.2)]">↗</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[96rem] px-6 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">What we build</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              Three ways we help businesses look better and operate smarter.
            </h2>
          </div>
          <Link href="/services" className="inline-flex items-center gap-2 text-sm font-black text-[var(--gold)] hover:text-[#f0ca50]">
            View all services <ArrowIcon />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="group rounded-[1.8rem] border border-[rgba(212,175,55,0.2)] bg-[linear-gradient(145deg,rgba(17,27,72,0.88),rgba(6,10,30,0.98))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-200 hover:-translate-y-1 hover:border-[rgba(245,158,11,0.48)] sm:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-[var(--gold)]">{service.number}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(212,175,55,0.22)] bg-[rgba(212,175,55,0.08)] text-[var(--gold)] transition group-hover:bg-[rgba(212,175,55,0.14)]">↗</span>
              </div>
              <h3 className="mt-8 text-2xl font-black text-white">{service.title}</h3>
              <p className="mt-4 leading-7 text-[var(--muted)]">{service.copy}</p>
              <ul className="mt-7 space-y-3 text-sm font-semibold text-slate-200">
                {service.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <CheckIcon />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="leadforge" className="mx-auto w-full max-w-[96rem] px-6 py-10 sm:px-8 lg:px-10 lg:py-16">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(212,175,55,0.3)] bg-[linear-gradient(145deg,#10183a_0%,#070c1e_48%,#050918_100%)] p-7 shadow-[0_42px_120px_rgba(0,0,0,0.54),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[rgba(245,158,11,0.16)] blur-[110px]" />
          <div className="relative grid gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Flagship product</p>
              <h2 className="mt-4 text-5xl font-black tracking-[-0.06em] text-white sm:text-7xl">LEADFORGE</h2>
              <p className="mt-5 text-2xl font-black text-[var(--gold)]">Search Once. Discover Continuously.</p>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                An AI-assisted territory discovery and sales intelligence platform for agencies. LEADFORGE is proof that we do more than design pages—we build full products, workflows, intelligence layers, and business systems.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-6 py-3.5 text-sm font-black text-[#07101f] shadow-[0_18px_42px_rgba(212,175,55,0.22)]"
                >
                  Build Something Powerful <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="rounded-[1.65rem] border border-white/[0.07] bg-[rgba(3,7,18,0.78)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">LeadForge workflow</p>
              <div className="mt-6 grid gap-3">
                {["Discover", "Build Territory", "Unlock Leads", "Pitch", "Win"].map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-4 rounded-2xl border border-[rgba(212,175,55,0.15)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] text-sm font-black text-[#07101f] shadow-[0_10px_24px_rgba(212,175,55,0.18)]">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-black text-white">{item}</p>
                      <div className="mt-2 h-1 rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#d4af37,#f59e0b)]" style={{ width: `${92 - index * 9}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[96rem] gap-12 px-6 py-20 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:py-28">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Built for real use</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">Not mockups. Not templates. Real production systems.</h2>
          <p className="mt-6 max-w-xl leading-8 text-[var(--muted)]">
            Every project is approached like a product: clear purpose, strong interface, responsive behavior, and a real business outcome.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {capabilities.map((capability) => (
            <div
              key={capability}
              className="rounded-2xl border border-[rgba(212,175,55,0.17)] bg-[linear-gradient(145deg,rgba(17,27,72,0.72),rgba(7,12,31,0.9))] p-5 shadow-[0_20px_46px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="h-1 w-12 rounded-full bg-[linear-gradient(90deg,#d4af37,#f59e0b)]" />
              <p className="mt-5 font-black text-white">{capability}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-black/[0.12]">
        <div className="mx-auto w-full max-w-[96rem] px-6 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">How it works</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">A clear build process without the agency runaround.</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {process.map(([number, title, copy]) => (
              <article
                key={number}
                className="rounded-[1.6rem] border border-[rgba(212,175,55,0.18)] bg-[linear-gradient(145deg,rgba(17,27,72,0.76),rgba(7,12,31,0.94))] p-6 shadow-[0_24px_54px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-sm font-black text-[var(--gold)]">{number}</p>
                <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[96rem] px-6 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(212,175,55,0.28)] bg-[linear-gradient(145deg,rgba(17,27,72,0.96),rgba(5,9,24,0.98))] p-8 text-center shadow-[0_38px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-12 lg:p-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-[rgba(245,158,11,0.14)] blur-[100px]" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--gold)]">Start your build</p>
            <h2 className="mx-auto mt-5 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">Build something your business can actually use.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              Premium website, AI system, internal tool, or custom workflow—start with the business problem and we will shape the right build.
            </p>
            <Link
              href="/contact"
              className="mt-9 inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#e2be48,#b78b1f)] px-8 py-4 text-sm font-black text-[#07101f] shadow-[0_20px_46px_rgba(212,175,55,0.24),inset_0_1px_0_rgba(255,255,255,0.42)] transition duration-200 hover:-translate-y-0.5"
            >
              Start a Project <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
