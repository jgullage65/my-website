import Link from "next/link";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { BuilderState } from "./AiBuilderClient";
import AiBuilderAuthCta from "./AiBuilderAuthCta";

type Props = {
  builder: BuilderState;
  session: AiBuilderSession | null;
  complete: boolean;
  percent: number;
  onReview: () => void;
  embedded?: boolean;
};

const pendingSteps = [
  "Reading business information",
  "Extracting business facts",
  "Generating customer Q&A",
  "Checking for conflicts",
  "Preparing business memory",
];

const shellClassName =
  "relative overflow-hidden bg-[#050505] px-4 py-8 sm:px-6 sm:py-10 min-[1200px]:rounded-2xl min-[1200px]:border min-[1200px]:border-white/[0.08] min-[1200px]:px-6 min-[1200px]:py-6";

export default function AiBuilderProgress({
  builder,
  session,
  complete,
  percent,
  onReview,
  embedded = false,
}: Props) {
  const progress = session?.buildProgress ?? [];
  const awaitingApprovalCount = session
    ? session.contextEntries.filter((entry) => entry.status === "proposed").length +
      session.faqEntries.filter((entry) => entry.status === "proposed").length
    : 0;

  return (
    <div className={embedded ? "w-full" : "w-full min-[1200px]:mx-auto min-[1200px]:max-w-5xl"}>
      <section className={embedded ? "w-full" : shellClassName}>
        {!embedded ? <AiBuilderAuthCta suppressSignOut={!complete} /> : null}

        <div className={embedded ? "relative border-b border-white/[0.08] pb-5" : "relative text-center"}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 sm:text-sm">
            {complete ? "Your AI is ready" : "Building your AI system"}
          </p>

          {!embedded ? <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl min-[1200px]:mt-2 min-[1200px]:text-3xl">{builder.businessName}</h1> : null}

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg min-[1200px]:mt-2 min-[1200px]:text-base min-[1200px]:leading-6">
            {complete
              ? "Your business knowledge has been organized and is ready for review."
              : "Teaching your AI about the business and preparing its knowledge."}
          </p>
        </div>

        <div className="relative mt-8 grid gap-4 min-[1200px]:mt-5 min-[1200px]:grid-cols-3 min-[1200px]:gap-3">
          {(complete ? progress : pendingSteps).map((item, index) => {
            const message = typeof item === "string" ? item : item.message;
            const itemCount = typeof item === "string" ? null : item.count;
            const count =
              complete && message === "Waiting for user approval"
                ? awaitingApprovalCount
                : itemCount;
            const stepPercent = complete
              ? 100
              : Math.max(0, Math.min(100, (percent - index * 20) * 5));
            const completed = stepPercent === 100 || (typeof item !== "string" && item.completed);

            return (
              <article
                key={`${message}-${index}`}
                className="rounded-2xl border border-white/[0.08] bg-black p-5 min-[1200px]:p-4"
              >
                <div className="flex flex-col items-center justify-center gap-2 text-center min-[1200px]:gap-1.5">
                  <span className="text-sm font-semibold text-white sm:text-base min-[1200px]:text-sm">
                    {completed ? <span className="text-amber-300">✓ </span> : null}
                    {message}
                  </span>

                  {!complete ? (
                    <span className="text-xs font-bold text-amber-300">{Math.round(stepPercent)}%</span>
                  ) : typeof count === "number" ? (
                    <span className="text-sm font-bold text-amber-300">
                      {count}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.08] min-[1200px]:mt-3 min-[1200px]:h-2">
                  <div className="h-full rounded-full bg-amber-300 transition-[width] duration-300" style={{ width: `${stepPercent}%` }} />
                </div>
              </article>
            );
          })}
        </div>

        {complete && session ? (
          <div className="relative mt-7 min-[1200px]:mt-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 min-[1200px]:gap-3">
              <Stat value={session.contextCounts.total} label="Facts" />
              <Stat value={session.faqEntries.length} label="Q&A" />
              <Stat value={session.conflicts.length} label="Conflicts" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 min-[1200px]:mt-4 min-[1200px]:gap-3">
              <Link
                href="/ai-builder"
                className="flex min-h-[56px] items-center justify-center rounded-2xl border border-amber-300/15 bg-[#080808] px-3 py-4 text-center text-sm font-bold text-white shadow-[0_16px_40px_rgba(245,158,11,0.14)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111] sm:px-5 sm:text-base min-[1200px]:min-h-[46px] min-[1200px]:rounded-xl min-[1200px]:py-3 min-[1200px]:text-sm"
              >
                Return to Projects
              </Link>

              <button
                type="button"
                onClick={onReview}
                className="min-h-[56px] rounded-2xl border border-amber-300/15 bg-[#080808] px-3 py-4 text-sm font-bold text-white shadow-[0_16px_40px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111] sm:px-5 sm:text-base min-[1200px]:min-h-[46px] min-[1200px]:rounded-xl min-[1200px]:py-3 min-[1200px]:text-sm"
              >
                Review business knowledge
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-black/20 px-3 py-4 text-center sm:px-5 min-[1200px]:rounded-xl min-[1200px]:px-3 min-[1200px]:py-2.5">
      <div className="text-2xl font-semibold text-amber-300 sm:text-3xl min-[1200px]:text-xl">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-400 sm:text-sm min-[1200px]:mt-0.5 min-[1200px]:text-xs">
        {label}
      </div>
    </div>
  );
}
