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
        {!embedded ? <AiBuilderAuthCta /> : null}

        <div className={embedded ? "relative border-b border-white/[0.08] pb-5 text-center" : "relative text-center"}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300 sm:text-sm">
            {complete ? "Your AI is ready" : "Building your AI system"}
          </p>

          {!embedded ? <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl min-[1200px]:mt-2 min-[1200px]:text-3xl">{builder.businessName}</h1> : null}
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 min-[1200px]:mt-5">
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
                className="rounded-2xl border border-white/[0.08] bg-black p-4"
              >
                <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                  <span className="text-sm font-semibold text-white">
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

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-amber-300 transition-[width] duration-300" style={{ width: `${stepPercent}%` }} />
                </div>
              </article>
            );
          })}
        </div>

        {complete && session ? (
          <div className="relative mt-5">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat value={session.contextCounts.total} label="Facts" />
              <Stat value={session.faqEntries.length} label="Q&A" />
              <Stat value={session.conflicts.length} label="Conflicts" />
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onReview}
                className="min-h-[46px] rounded-xl border border-amber-300/15 bg-[#080808] px-8 py-3 text-sm font-bold text-white shadow-[0_16px_40px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111]"
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
    <div className="rounded-xl border border-amber-300/25 bg-black/20 px-2 py-2.5 text-center sm:px-3">
      <div className="text-xl font-semibold text-amber-300">
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-slate-400">
        {label}
      </div>
    </div>
  );
}
