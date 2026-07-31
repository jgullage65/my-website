"use client";

import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

export type ProjectDiagnostics = {
  crawls: Array<Record<string, unknown>>;
  generations: Array<Record<string, unknown>>;
};

const n = (value: unknown) => (typeof value === "number" ? value : null);
const when = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(value)))
    : null;

const duration = (value: unknown) => {
  const milliseconds = n(value);
  if (milliseconds == null) return null;
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${Math.round(milliseconds / 1000)}s`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
};

export default function AiBuilderProjectInsights() {
  const { projectId, diagnostics, setActiveTab } = useAiBuilderWorkspace();
  const crawl = diagnostics?.crawls[0];
  const generation = diagnostics?.generations[0];
  const crawlStatus = String(crawl?.status ?? "not_available");
  const generationStatus = String(generation?.status ?? "not_available");

  return (
    <div data-project-id={projectId} className="space-y-5 pb-2">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Website import" value={statusLabel(crawlStatus)} detail={when(crawl?.completed_at ?? crawl?.started_at) ?? "No recorded attempt"} status={crawlStatus} />
        <SummaryCard label="AI generation" value={statusLabel(generationStatus)} detail={when(generation?.completed_at ?? generation?.started_at) ?? "No recorded attempt"} status={generationStatus} />
        <SummaryCard label="Pages processed" value={String(n(crawl?.pages_processed) ?? 0)} detail={`${n(crawl?.pages_failed) ?? 0} failed · ${n(crawl?.pages_skipped) ?? 0} skipped`} />
        <SummaryCard label="Generated output" value={String((n(generation?.knowledge_count) ?? 0) + (n(generation?.faq_count) ?? 0))} detail={`${n(generation?.knowledge_count) ?? 0} knowledge · ${n(generation?.faq_count) ?? 0} Q&A`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          eyebrow="Source diagnostics"
          title="Website import"
          actionLabel="Open sources"
          onAction={() => setActiveTab("sources")}
        >
          <Grid
            items={[
              ["Attempt", n(crawl?.attempt_number)],
              ["Last import", when(crawl?.completed_at ?? crawl?.started_at)],
              ["Discovered", n(crawl?.pages_discovered)],
              ["Processed", n(crawl?.pages_processed)],
              ["Skipped", n(crawl?.pages_skipped)],
              ["Failed", n(crawl?.pages_failed)],
              ["Duration", duration(crawl?.duration_ms)],
              [
                "Failure stage",
                crawl?.failure_stage
                  ? String(crawl.failure_stage).replaceAll("_", " ")
                  : null,
              ],
            ]}
          />

          <HistorySection title="Recent website import attempts">
            <AttemptTable items={diagnostics?.crawls ?? []} kind="crawl" />
          </HistorySection>
        </Panel>

        <Panel
          eyebrow="Generation diagnostics"
          title="Knowledge generation"
          actionLabel="Review knowledge"
          onAction={() => setActiveTab("knowledge")}
        >
          <Grid
            items={[
              ["Attempt", n(generation?.attempt_number)],
              [
                "Last attempt",
                when(generation?.completed_at ?? generation?.started_at),
              ],
              ["Knowledge items", n(generation?.knowledge_count)],
              ["Generated Q&A", n(generation?.faq_count)],
              ["Model", generation?.model ? String(generation.model) : null],
              ["Input tokens", n(generation?.input_tokens)],
              ["Output tokens", n(generation?.output_tokens)],
              ["Total tokens", n(generation?.total_tokens)],
              ["Retries", n(generation?.retry_count)],
              ["Duration", duration(generation?.duration_ms)],
            ]}
          />

          <HistorySection title="Recent AI generation attempts">
            <AttemptTable
              items={diagnostics?.generations ?? []}
              kind="generation"
            />
          </HistorySection>
        </Panel>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status?: string;
}) {
  return (
    <article className="rounded-[18px] border border-white/[0.07] bg-[#070707] p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${status ? statusTone(status) : "text-white"}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function Panel({
  eyebrow,
  title,
  actionLabel,
  onAction,
  children,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[620px] flex-col rounded-xl border border-white/[.08] bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-amber-300 transition hover:text-amber-200"
        >
          {actionLabel}
        </button>
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function HistorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-white/[.08] pt-5">
      <h4 className="mb-4 text-center text-base font-semibold text-white">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Grid({ items }: { items: Array<[string, unknown]> }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/[.07]">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="border-b border-r border-white/[.07] bg-black/40 px-3.5 py-3 text-center even:border-r-0"
        >
          <dt className="text-xs text-[var(--gold)]">{label}</dt>
          <dd
            className={`mt-1 text-sm font-semibold ${
              value === null || value === undefined
                ? "text-slate-600"
                : "text-white"
            }`}
          >
            {value === null || value === undefined
              ? "Not available"
              : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AttemptTable({
  items,
  kind,
}: {
  items: Array<Record<string, unknown>>;
  kind: "crawl" | "generation";
}) {
  const rows = items.slice(0, 5);

  if (!rows.length) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[.07] bg-black/40 px-5 text-center text-sm text-slate-600">
        No attempts available
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/[.07]">
      <div className="grid grid-cols-[1.2fr_.8fr_.7fr] border-b border-white/[.07] bg-black/60 px-3 py-2 text-center text-xs text-[var(--gold)]">
        <span>Started</span>
        <span>{kind === "crawl" ? "Pages" : "Model"}</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-white/[.07]">
        {rows.map((item, index) => (
          <div
            key={`${kind}-${String(item.started_at ?? index)}`}
            className="grid grid-cols-[1.2fr_.8fr_.7fr] items-center px-3 py-3 text-center text-sm"
          >
            <span className="text-slate-300">
              {when(item.started_at) ?? "Not available"}
            </span>
            <span className="font-semibold text-white">
              {kind === "crawl"
                ? String(
                    n(item.pages_processed) ??
                      n(item.pages_discovered) ??
                      "Not available",
                  )
                : item.model
                  ? String(item.model)
                  : "Not available"}
            </span>
            <Status value={item.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(value: string) {
  return value === "not_available" ? "No data" : value.replaceAll("_", " ");
}

function statusTone(value: string) {
  if (value === "completed" || value === "success") return "text-emerald-300";
  if (value === "failed" || value === "error") return "text-red-300";
  if (value === "running" || value === "processing") return "text-amber-300";
  return "text-slate-300";
}

function Status({ value }: { value: unknown }) {
  const normalized = String(value ?? "unknown");
  return (
    <span className={`inline-flex justify-center rounded-lg border border-white/[0.08] bg-black px-2.5 py-1 text-xs font-bold capitalize ${statusTone(normalized)}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}
