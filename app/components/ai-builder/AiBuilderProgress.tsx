import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { BuilderState } from "./AiBuilderClient";

type Props = {
  builder: BuilderState;
  session: AiBuilderSession | null;
  complete: boolean;
  onReview: () => void;
};

const pendingSteps = [
  "Reading business information",
  "Extracting business facts",
  "Generating customer Q&A",
  "Checking for conflicts",
  "Preparing business memory",
];

const shellClassName =
  "relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#030713] px-5 py-7 shadow-[0_24px_90px_rgba(0,0,0,0.34),0_0_50px_rgba(245,158,11,0.06)] sm:px-8 sm:py-9";

export default function AiBuilderProgress({
  builder,
  session,
  complete,
  onReview,
}: Props) {
  const progress = session?.buildProgress ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <section className={shellClassName}>
        <div className="pointer-events-none absolute inset-x-0 top-[-8rem] mx-auto h-56 max-w-3xl rounded-full bg-amber-400/10 blur-[90px]" />

        <div className="relative text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 sm:text-sm">
            {complete ? "Your AI is ready" : "Building your AI system"}
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            {builder.businessName}
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            {complete
              ? "Your business knowledge has been organized and is ready for review."
              : "Teaching your AI about the business and preparing its knowledge."}
          </p>
        </div>

        <div className="relative mt-8 grid gap-4">
          {(complete ? progress : pendingSteps).map((item, index) => {
            const message = typeof item === "string" ? item : item.message;
            const count = typeof item === "string" ? null : item.count;
            const completed =
              complete || (typeof item !== "string" && item.completed);

            return (
              <article
                key={`${message}-${index}`}
                className="rounded-[22px] border border-white/[0.08] bg-black/20 p-5 shadow-inner shadow-black/20"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-left text-sm font-semibold text-white sm:text-base">
                    {completed ? "✓ " : ""}
                    {message}
                  </span>

                  {typeof count === "number" ? (
                    <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.08)]">
                      {count}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={
                      completed
                        ? "h-full w-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
                        : "h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400"
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>

        {complete && session ? (
          <div className="relative mt-7">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Stat value={session.contextCounts.total} label="Facts" />
              <Stat value={session.faqEntries.length} label="Q&A" />
              <Stat value={session.conflicts.length} label="Conflicts" />
            </div>

            <button
              type="button"
              onClick={onReview}
              className="mt-6 w-full rounded-2xl border border-amber-200/50 bg-amber-300 px-5 py-4 font-bold text-[#101827] shadow-[0_16px_40px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:bg-amber-200"
            >
              Review business knowledge
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-4 text-center sm:px-5">
      <div className="text-2xl font-semibold text-amber-300 sm:text-3xl">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">
        {label}
      </div>
    </div>
  );
}
