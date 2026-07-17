import Link from "next/link";

export const metadata = {
  title: "Thank You",
};

export default function ThankYouPage() {
  return (
    <main className="relative min-h-[72vh] overflow-hidden bg-[#030713] text-white">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,.16),transparent_24rem),radial-gradient(circle_at_82%_12%,rgba(14,22,62,.68),transparent_34rem)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,.022)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

      <section className="relative z-10 mx-auto flex min-h-[72vh] max-w-4xl items-center px-5 py-16 text-center sm:px-8 lg:px-10">
        <div className="w-full rounded-[1.75rem] border border-[rgba(212,175,55,.2)] bg-[linear-gradient(145deg,rgba(9,16,32,.96),rgba(2,5,14,.99))] px-6 py-12 shadow-[0_34px_100px_rgba(0,0,0,.42),inset_0_1px_0_rgba(255,255,255,.04)] sm:px-10 sm:py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(212,175,55,.35)] bg-[linear-gradient(180deg,#e1bd45,#b88c1f)] text-2xl font-black text-[#07101f] shadow-[0_16px_36px_rgba(212,175,55,.2),inset_0_1px_0_rgba(255,255,255,.42)]">
            ✓
          </div>

          <p className="mt-7 text-xs font-black uppercase tracking-[.28em] text-[var(--gold)]">
            Message received
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-5xl lg:text-6xl">
            Thank you. I’ll be in touch soon.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
            Your message is in. I’ll review the details and reply as soon as possible with the clearest next step.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-[linear-gradient(180deg,#ffd56a,#c89426)] px-5 py-3 text-sm font-black text-[#06101f] shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition hover:-translate-y-0.5"
            >
              Back to Home
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-amber-300/[.03] px-5 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-amber-300/[.06]"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
