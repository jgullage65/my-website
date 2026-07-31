import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";

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

export default function AiBuilderProjectInsights({
  diagnostics,
}: {
  session: AiBuilderSession;
  diagnostics: ProjectDiagnostics | null;
  messageCount: number;
}) {
  const crawl = diagnostics?.crawls[0];
  const generation = diagnostics?.generations[0];

  return (
    <div className="grid auto-rows-fr gap-5 pb-2 lg:grid-cols-2">
      <Panel title="Website crawl">
        <Grid
          items={[
            ["Attempt", n(crawl?.attempt_number)],
            ["Last crawl", when(crawl?.completed_at ?? crawl?.started_at)],
            ["Discovered", n(crawl?.pages_discovered)],
            ["Processed", n(crawl?.pages_processed)],
            ["Skipped", n(crawl?.pages_skipped)],
            ["Failed", n(crawl?.pages_failed)],
            [
              "Duration",
              n(crawl?.duration_ms) != null
                ? `${Math.round(n(crawl?.duration_ms)! / 1000)}s`
                : null,
            ],
            [
              "Failure stage",
              crawl?.failure_stage
                ? String(crawl.failure_stage).replaceAll("_", " ")
                : null,
            ],
          ]}
        />
        {crawl ? (
          <Notices
            warnings={crawl.warnings}
            errors={crawl.errors}
            restrictions={crawl.restrictions}
          />
        ) : null}
      </Panel>

      <Panel title="Knowledge generation">
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
            [
              "Duration",
              n(generation?.duration_ms) != null
                ? `${Math.round(n(generation?.duration_ms)! / 1000)}s`
                : null,
            ],
            [
              "Failure stage",
              generation?.failure_stage
                ? String(generation.failure_stage).replaceAll("_", " ")
                : null,
            ],
          ]}
        />
        {generation ? (
          <Notices warnings={generation.warnings} errors={generation.errors} />
        ) : null}
      </Panel>

      <Panel title="Recent crawl attempts">
        <AttemptTable items={diagnostics?.crawls ?? []} kind="crawl" />
      </Panel>

      <Panel title="Recent AI generations">
        <AttemptTable items={diagnostics?.generations ?? []} kind="generation" />
      </Panel>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full min-h-[310px] flex-col rounded-xl border border-white/[.08] bg-[#050505] p-5">
      <h3 className="text-center text-base font-semibold text-white">{title}</h3>
      <div className="mt-4 flex-1">{children}</div>
    </section>
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
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-white/[.07] bg-black/40 px-5 text-center text-sm text-slate-600">
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

function Status({ value }: { value: unknown }) {
  return (
    <span className="inline-flex justify-center rounded-lg border border-amber-300/20 bg-black px-2.5 py-1 text-xs font-bold capitalize text-white">
      {String(value ?? "Unknown").replaceAll("_", " ")}
    </span>
  );
}

function Notices({
  warnings,
  errors,
  restrictions,
}: {
  warnings: unknown;
  errors: unknown;
  restrictions?: unknown;
}) {
  const rows = [
    ...[...(Array.isArray(warnings) ? warnings : [])].map((item) => ({
      tone: "warning",
      item,
    })),
    ...[...(Array.isArray(errors) ? errors : [])].map((item) => ({
      tone: "error",
      item,
    })),
    ...[...(Array.isArray(restrictions) ? restrictions : [])].map((item) => ({
      tone: "restriction",
      item,
    })),
  ].flatMap(({ tone, item }) => {
    const record =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};
    const rawMessage =
      typeof record.message === "string" ? record.message.trim() : "";
    if (!rawMessage) return [];
    if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(rawMessage)) return [];
    return [{ tone, message: rawMessage }];
  });

  const uniqueRows = Array.from(
    new Map(rows.map((row) => [row.message.toLowerCase(), row])).values(),
  );

  if (!uniqueRows.length) return null;

  return (
    <div className="mt-4 space-y-2">
      {uniqueRows.slice(0, 4).map(({ tone, message }, index) => (
        <div
          key={`${tone}-${index}`}
          className={`rounded-lg border px-3 py-2 text-xs ${
            tone === "error"
              ? "border-red-400/20 bg-red-400/[.06] text-red-200"
              : "border-amber-300/15 bg-amber-300/[.05] text-amber-100"
          }`}
        >
          {message}
        </div>
      ))}
    </div>
  );
}
