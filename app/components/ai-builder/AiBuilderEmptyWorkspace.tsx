"use client";

import { useEffect, useState } from "react";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderWorkspaceFrame from "./AiBuilderWorkspaceFrame";
import type { BuilderState } from "./AiBuilderClient";

type Props = {
  builder: BuilderState;
  error?: string | null;
  onChange: (value: BuilderState) => void;
  onBuild: () => void;
};

type ProjectSummary = {
  id: string;
  archivedAt?: string | null;
  updatedAt?: string;
};

const WORKSPACE_ITEMS = [
  ["projects", "Projects"],
  ["dashboard", "Dashboard"],
  ["insights", "Project Insights"],
  ["overview", "Overview"],
  ["knowledge", "Business Knowledge"],
  ["sources", "Sources"],
  ["settings", "Settings"],
] as const;

const LAST_PROJECT_COOKIE = "ai_builder_last_project";

function readRememberedProjectId() {
  const prefix = `${LAST_PROJECT_COOKIE}=`;
  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

function DisabledAssistantPreview() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <header className="flex min-h-[76px] flex-none flex-col items-center justify-center gap-1.5 border-b border-white/[0.08] bg-black px-5 py-2 text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-amber-300">Live assistant test</p>
        <label className="flex min-w-0 items-center justify-center gap-2 text-xs font-semibold text-slate-300">
          <span className="shrink-0">Active model</span>
          <select disabled aria-label="Active AI model" className="min-w-0 max-w-[13rem] cursor-not-allowed rounded-lg border border-amber-300/20 bg-black px-3 py-2 text-white opacity-70">
            <option>GPT-5 Mini · Recommended</option>
          </select>
        </label>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-amber-300/25 bg-[#0a0a0a] px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,.2)]">
            <p>Hi, I’m your Business AI. Ask me anything about this business.</p>
          </div>
        </div>

        <div className="flex-none border-t border-white/[0.08] p-4 sm:p-5">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-amber-300/25 bg-[#0a0a0a] p-2 shadow-[0_12px_32px_rgba(0,0,0,.22)]">
            <textarea
              rows={2}
              disabled
              placeholder="Ask about services, pricing, policies, or the business..."
              className="min-h-[52px] flex-1 cursor-not-allowed resize-none border-0 bg-transparent px-3 py-3 text-sm text-white opacity-60 outline-none placeholder:text-slate-500"
            />
            <button type="button" disabled className="min-h-[52px] cursor-not-allowed rounded-xl border border-amber-300/15 bg-[#080808] px-4 text-sm font-black text-white opacity-35">Send</button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">Build your AI before using the live assistant.</p>
        </div>
      </section>
    </div>
  );
}

export default function AiBuilderEmptyWorkspace({ builder, error = null, onChange, onBuild }: Props) {
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { projects?: ProjectSummary[] };
        const activeProjects = Array.isArray(payload.projects)
          ? payload.projects.filter((project) => !project.archivedAt)
          : [];
        if (!activeProjects.length) return null;

        const rememberedProjectId = readRememberedProjectId();
        const rememberedProject = rememberedProjectId
          ? activeProjects.find((project) => project.id === rememberedProjectId)
          : undefined;
        const fallbackProject = [...activeProjects].sort((left, right) => {
          const leftTime = new Date(left.updatedAt ?? 0).getTime();
          const rightTime = new Date(right.updatedAt ?? 0).getTime();
          return rightTime - leftTime;
        })[0];

        return rememberedProject?.id ?? fallbackProject?.id ?? null;
      })
      .then((projectId) => {
        if (!cancelled) setExistingProjectId(projectId);
      })
      .catch(() => {
        if (!cancelled) setExistingProjectId(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function showFirstProjectRequired() {
    const goToBuilder = await showConfirm({
      title: "Create your first project",
      message: "Build your first AI project to access the rest of the workspace.",
      cancelLabel: "Cancel",
      confirmLabel: "Go to AI Builder",
    });

    if (!goToBuilder) return;
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".ai-builder-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function openWorkspace(value: string) {
    if (!existingProjectId) {
      void showFirstProjectRequired();
      return;
    }

    const tab = value === "knowledge" ? "dashboard" : value;
    const review = value === "knowledge" ? "&review=1" : "";
    window.location.assign(
      `/ai-builder?projectId=${encodeURIComponent(existingProjectId)}&tab=${encodeURIComponent(tab)}${review}`,
    );
  }

  return (
    <>
      <style jsx global>{`
        .ai-builder-form a[href="/ai-builder"] {
          display: none !important;
        }

        @media (min-width: 1200px) {
          .ai-builder-form > div > div > section:last-child {
            width: min(100%, 30rem) !important;
            max-width: 30rem !important;
            justify-self: center !important;
            padding-left: 1.25rem !important;
            padding-right: 1.25rem !important;
          }

          .ai-builder-form > div > div {
            grid-template-columns: minmax(22rem, 0.66fr) minmax(44rem, 1.34fr) !important;
            column-gap: 1.5rem !important;
          }
        }
      `}</style>

      <AiBuilderWorkspaceFrame
        title="AI Builder"
        builderActive
        onBuilderSelect={() => {
          document.querySelector<HTMLElement>(".ai-builder-form")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        items={WORKSPACE_ITEMS.map(([value, label]) => ({
          value,
          label,
          onSelect: () => openWorkspace(value),
        }))}
        rightRail={<DisabledAssistantPreview />}
        overlays={confirmDialogNode}
      >
        <div className="ai-builder-form mx-auto w-full max-w-[1600px]">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <AiBuilderForm value={builder} onChange={onChange} onBuild={onBuild} />
        </div>
      </AiBuilderWorkspaceFrame>
    </>
  );
}
