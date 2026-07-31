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
    <div className="flex h-full min-h-0 flex-col bg-[#020202] p-4 text-white">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div>
          <p className="text-sm font-semibold text-white">AI Assistant</p>
          <p className="mt-1 text-xs text-slate-500">Preview</p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-200">
          Locked
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between py-5">
        <div className="space-y-4 opacity-60" aria-hidden="true">
          <div className="max-w-[88%] rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="h-2.5 w-24 rounded-full bg-white/[0.08]" />
            <div className="mt-3 h-2.5 w-full rounded-full bg-white/[0.06]" />
            <div className="mt-2 h-2.5 w-4/5 rounded-full bg-white/[0.06]" />
          </div>
          <div className="ml-auto max-w-[78%] rounded-2xl border border-amber-300/10 bg-amber-300/[0.025] p-4">
            <div className="h-2.5 w-20 rounded-full bg-amber-200/[0.08]" />
            <div className="mt-3 h-2.5 w-full rounded-full bg-amber-200/[0.06]" />
          </div>
        </div>

        <div className="py-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] text-lg text-amber-200">
            ✦
          </div>
          <p className="mt-4 text-sm font-semibold text-white">Your assistant will appear here</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-500">
            Complete the required fields and build your AI to start chatting.
          </p>
        </div>

        <div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#050505] p-3">
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black px-4 py-3 text-sm text-slate-600">
              <span className="flex-1">Ask your AI anything...</span>
              <span aria-hidden="true">↗</span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">Chat is disabled until your AI is built.</p>
        </div>
      </div>
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
      <div className="ai-builder-form mx-auto w-full max-w-[1500px]">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        <AiBuilderForm value={builder} onChange={onChange} onBuild={onBuild} />
      </div>
    </AiBuilderWorkspaceFrame>
  );
}
