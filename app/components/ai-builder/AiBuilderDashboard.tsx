"use client";

import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

type Destination = "knowledge" | "sources" | "settings" | "assistant";

const timestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
};

const freshness = (value: string) => {
  const parsed = timestamp(value);
  if (!parsed) return "Update time unavailable";
  const days = Math.max(0, Math.floor((Date.now() - parsed) / 86_400_000));
  return days === 0
    ? "Updated today"
    : days === 1
      ? "Updated yesterday"
      : `Updated ${days} days ago`;
};

const compactIndustry = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Industry not set";
  const primary =
    normalized.split(/\s+[–—-]\s+|\s+\/\s+|,|\(/)[0]?.trim() || normalized;
  const words = primary.split(" ");
  return words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : primary;
};

export default function AiBuilderDashboard({ showcase = false }: { showcase?: boolean }) {
  const workspace = useAiBuilderWorkspace();
  const { session, websiteKnowledge, messages, diagnostics, project } = workspace;

  const onNavigate = (destination: Destination) => {
    if (destination === "assistant") {
      document
        .querySelector<HTMLTextAreaElement>('textarea[placeholder^="Ask about"]')
        ?.focus();
      return;
    }
    workspace.setActiveTab(destination);
  };

  const pending = [...session.contextEntries, ...session.faqEntries].filter(
    (item) => item.status === "proposed",
  ).length;
  const unresolvedConflicts = session.conflicts.filter((item) => !item.resolved).length;
  const missing = session.missingInformation.filter((item) => !item.resolved).length;
  const warnings = websiteKnowledge?.warnings.length ?? 0;
  const websiteConnected = Boolean(
    websiteKnowledge?.imported_at ||
      session.contextEntries.some((item) => item.source.sourceType === "website"),
  );

  const attention = [
    pending
      ? {
          label: `${pending} item${pending === 1 ? "" : "s"} waiting for review`,
          detail: "Approve, correct, or remove proposed knowledge.",
          action: "knowledge" as const,
        }
      : null,
    unresolvedConflicts
      ? {
          label: `${unresolvedConflicts} unresolved conflict${unresolvedConflicts === 1 ? "" : "s"}`,
          detail: "Resolve contradictory business information.",
          action: "knowledge" as const,
        }
      : null,
    missing
      ? {
          label: `${missing} information gap${missing === 1 ? "" : "s"}`,
          detail: "Add details the assistant still needs.",
          action: "knowledge" as const,
        }
      : null,
    warnings
      ? {
          label: `${warnings} website import warning${warnings === 1 ? "" : "s"}`,
          detail: "Review source coverage and skipped content.",
          action: "sources" as const,
        }
      : null,
    !websiteConnected
      ? {
          label: "No website source connected",
          detail: "Import a website to broaden the assistant’s source material.",
          action: "sources" as const,
        }
      : null,
    !messages.length
      ? {
          label: "Assistant has not been tested",
          detail: "Run a few realistic customer questions before relying on its responses.",
          action: "assistant" as const,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const recent = [
    ...session.contextEntries.map((item) => ({
      label: `Knowledge ${item.status}`,
      detail: item.title,
      at: item.updatedAt,
    })),
    ...session.faqEntries.map((item) => ({
      label: `Q&A ${item.status}`,
      detail: item.question,
      at: item.updatedAt,
    })),
    ...(websiteKnowledge?.imported_at
      ? [
          {
            label: "Website imported",
            detail: `${websiteKnowledge.pages.length} source page${websiteKnowledge.pages.length === 1 ? "" : "s"}`,
            at: websiteKnowledge.imported_at,
          },
        ]
      : []),
    ...messages.slice(-3).map((item) => ({
      label: item.role === "user" ? "Assistant test question" : "Assistant test response",
      detail: "Saved conversation activity",
      at: item.createdAt,
    })),
  ]
    .filter((item) => Boolean(item.at))
    .sort((a, b) => timestamp(b.at) - timestamp(a.at))
    .slice(0, 6);

  const sourceCounts = session.contextEntries.reduce<Record<string, number>>(
    (counts, item) => {
      const key = item.source.sourceType;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );

  const sourceFreshness = session.contextEntries.reduce<Record<string, string>>(
    (latest, item) => {
      const key = item.source.sourceType;
      if (!latest[key] || timestamp(item.updatedAt) > timestamp(latest[key]!)) {
        latest[key] = item.updatedAt;
      }
      return latest;
    },
    {},
  );

  const successfulGeneration = [...(diagnostics?.generations ?? [])]
    .filter((item) =>
      ["completed", "success", "succeeded"].includes(
        String(item.status ?? "").toLowerCase(),
      ),
    )
    .sort(
      (a, b) =>
        timestamp(String(b.completed_at ?? b.started_at ?? "")) -
        timestamp(String(a.completed_at ?? a.started_at ?? "")),
    )[0];
  const completedBuild = session.buildProgress
    .filter((item) => item.completed && item.stage === "complete")
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))[0];
  const lastBuildAt =
    successfulGeneration?.completed_at ??
    successfulGeneration?.started_at ??
    completedBuild?.createdAt ??
    (session.status === "ready" ? session.updatedAt : null);

  const approvedFaq = session.faqEntries.filter(
    (item) => item.status === "approved" || item.status === "corrected",
  ).length;
  const approvedKnowledge = session.contextEntries.filter(
    (item) => item.status === "approved" || item.status === "corrected",
  ).length;
  const hasGeneratedKnowledge = session.contextEntries.length + session.faqEntries.length > 0;
  const hasAssistantTest =
    messages.some((item) => item.role === "user") &&
    messages.some((item) => item.role === "assistant");

  const readinessChecks = [
    { label: "Source connected", complete: websiteConnected },
    { label: "Knowledge generated", complete: hasGeneratedKnowledge },
    {
      label: "Review complete",
      complete: pending === 0 && unresolvedConflicts === 0 && missing === 0,
    },
    { label: "Build completed", complete: Boolean(lastBuildAt) },
    { label: "Assistant tested", complete: hasAssistantTest },
  ];
  const completedReadinessChecks = readinessChecks.filter((item) => item.complete).length;
  const readinessStatus =
    session.status === "failed"
      ? "Build needs attention"
      : session.status === "draft" || session.status === "extracting"
        ? "Build in progress"
        : pending || unresolvedConflicts || missing
          ? "Review required"
          : !hasAssistantTest
            ? "Testing recommended"
            : "Core validation complete";

  const readinessCard = (
    <section className="h-full rounded-xl border border-white/[.12] bg-[#050505] p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">
        Project readiness
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em] text-white">
        {readinessStatus}
      </h2>
      <p className="mt-3 text-sm font-semibold text-slate-300">
        {completedReadinessChecks} of {readinessChecks.length} signals ready
      </p>
      <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-5 gap-y-2">
        {readinessChecks.map((item) => (
          <span
            key={item.label}
            className={`text-xs font-medium ${item.complete ? "text-emerald-300" : "text-slate-600"}`}
          >
            {item.complete ? "✓" : "○"} {item.label}
          </span>
        ))}
      </div>
    </section>
  );

  return (
    <div className={`space-y-5 pb-2 ${showcase ? "h-full" : ""}`}>
      <section className="grid gap-4 sm:grid-cols-4 sm:gap-2.5 min-[1200px]:gap-4">
        <Summary
          label="Project"
          value={project.businessName || "Untitled project"}
          detail={compactIndustry(project.industry)}
        />
        <Summary
          label="Approved knowledge"
          value={String(approvedKnowledge)}
          detail={`${approvedFaq} approved Q&A`}
        />
        <Summary
          label="Source material"
          value={String(websiteKnowledge?.pages.length ?? 0)}
          detail={websiteConnected ? "Website source connected" : "No website source"}
        />
        <Summary
          label="Assistant tests"
          value={String(messages.filter((item) => item.role === "user").length)}
          detail={hasAssistantTest ? "Conversation activity recorded" : "No completed test yet"}
        />
      </section>

      <div className={`grid gap-5 min-[1024px]:grid-cols-2 ${showcase ? "h-full min-[1024px]:items-stretch" : ""}`}>
        <section className="h-full rounded-xl border border-white/[.12] bg-[#050505] p-5">
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">
            Action center
          </p>
          <div className="mt-2 flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">Needs attention</h3>
            <span className="rounded-full border border-white/[.12] bg-black px-2.5 py-1 text-xs font-semibold text-slate-400">
              {attention.length}
            </span>
          </div>
          {attention.length ? (
            <div className="mt-3 divide-y divide-white/[.12]">
              {attention.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.action)}
                  className="group flex w-full items-center justify-between gap-4 py-3.5 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                  </div>
                  <span className="text-amber-300 transition group-hover:translate-x-1">→</span>
                </button>
              ))}
            </div>
          ) : (
            <Empty text="This project has no outstanding review, source, or testing tasks." />
          )}
        </section>

        {readinessCard}

        <section className="h-full rounded-xl border border-white/[.12] bg-[#050505] p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">
            Knowledge source
          </p>
          {Object.keys(sourceCounts).length ? (
            <dl className="mt-4 divide-y divide-white/[.12] text-left">
              {Object.entries(sourceCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between py-3.5">
                    <dt>
                      <span className="text-sm font-semibold capitalize text-white">
                        {source.replace(/_/g, " ")}
                      </span>
                      {sourceFreshness[source] ? (
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {freshness(sourceFreshness[source]!)}
                        </span>
                      ) : null}
                    </dt>
                    <dd className="text-sm font-semibold text-white">{count}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <Empty text="Source composition will appear after knowledge is generated." />
          )}
          {websiteKnowledge?.imported_at ? (
            <p className="mt-3 text-xs text-slate-500">
              Website · {freshness(websiteKnowledge.imported_at)}
            </p>
          ) : null}
          <Action onClick={() => onNavigate("sources")}>Inspect source material</Action>
        </section>

        <section className={`h-full rounded-xl border border-white/[.12] bg-[#050505] p-5 ${showcase ? "flex flex-col" : ""}`}>
          <p className="text-center text-xs font-bold uppercase tracking-[.16em] text-slate-500">
            Recent project changes
          </p>
          {recent.length ? (
            <div className="mt-4 divide-y divide-white/[.12]">
              {recent.map((item, index) => (
                <div
                  key={`${item.label}-${item.at}-${index}`}
                  className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-3"
                >
                  <p className="text-[.65rem] font-bold uppercase tracking-[.1em] text-white">
                    {item.label}
                  </p>
                  <p className="truncate text-sm text-slate-300">{item.detail}</p>
                  <time className="text-xs text-slate-500">{date(item.at)}</time>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No project changes have been recorded yet." />
          )}
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-[18px] border border-white/[.12] bg-[#070707] p-5 text-center sm:rounded-[14px] sm:p-3 min-[1200px]:rounded-[18px] min-[1200px]:p-5">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500 sm:text-[0.58rem] sm:leading-3 sm:tracking-[.1em] min-[1200px]:text-xs min-[1200px]:leading-normal min-[1200px]:tracking-[.16em]">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-white sm:mt-1.5 sm:text-lg sm:leading-6 min-[1200px]:mt-2 min-[1200px]:text-2xl" title={value}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500 sm:mt-1.5 sm:text-[0.65rem] sm:leading-4 min-[1200px]:mt-2 min-[1200px]:text-xs min-[1200px]:leading-5" title={detail}>
        {detail}
      </p>
    </article>
  );
}

function Action({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cta-raised mt-4 rounded-lg border border-amber-300/20 bg-black px-3.5 py-2 text-xs font-semibold text-white transition hover:border-amber-300/40"
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="mt-3 border-l border-white/15 py-2 pl-3 text-center text-sm leading-6 text-slate-500">
      {text}
    </p>
  );
}