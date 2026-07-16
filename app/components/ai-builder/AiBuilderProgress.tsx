
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { BuilderState } from "./AiBuilderClient";

type Props = {
  builder: BuilderState;
  session: AiBuilderSession | null;
  complete: boolean;
};

const pendingSteps = [
  "Reading business information",
  "Extracting business facts",
  "Generating customer Q&A",
  "Checking for conflicts",
  "Preparing business memory",
];

export default function AiBuilderProgress({
  builder,
  session,
  complete,
}: Props) {
  const progress = session?.buildProgress ?? [];

  return (
    <div className="space-y-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-amber-400">
          {complete
            ? "Business loaded"
            : "Building your AI system"}
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          {builder.businessName}
        </h2>

        <p className="mt-1 text-neutral-400">
          {complete
            ? `${builder.assistantName} is ready for knowledge review.`
            : `Teaching ${builder.assistantName} about your business...`}
        </p>
      </div>

      <div className="space-y-4">
        {(complete ? progress : pendingSteps).map(
          (item, index) => {
            const message =
              typeof item === "string"
                ? item
                : item.message;
            const count =
              typeof item === "string"
                ? null
                : item.count;
            const completed =
              complete ||
              (typeof item !== "string" &&
                item.completed);

            return (
              <div
                key={`${message}-${index}`}
                className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-white">
                    {completed ? "✓ " : ""}
                    {message}
                  </span>

                  {typeof count === "number" ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      {count}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={
                      completed
                        ? "h-full w-full rounded-full bg-amber-500"
                        : "h-full w-1/3 animate-pulse rounded-full bg-amber-500/60"
                    }
                  />
                </div>
              </div>
            );
          },
        )}
      </div>

      {complete && session ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-2xl font-bold text-white">
              {session.contextCounts.total}
            </div>
            <div className="text-sm text-neutral-400">
              Business facts
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-2xl font-bold text-white">
              {session.faqEntries.length}
            </div>
            <div className="text-sm text-neutral-400">
              Q&A entries
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-2xl font-bold text-white">
              {session.conflicts.length}
            </div>
            <div className="text-sm text-neutral-400">
              Conflicts found
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
