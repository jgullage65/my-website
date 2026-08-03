"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderModelSelect, { type AiBuilderModelChoice } from "./AiBuilderModelSelect";
import { warmAiBuilderProjectResponse } from "./AiBuilderProjectClientCache";
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
  const [modelId, setModelId] = useState("");
  const [modelChoices, setModelChoices] = useState<AiBuilderModelChoice[]>([]);

  useEffect(() => {
    void fetch("/api/ai-builder/models?purpose=test-assistant")
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.ok) return;
        setModelChoices(payload.models);
        setModelId(payload.defaultModelId);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#000000] text-white">
      <header className="flex min-h-[76px] flex-none flex-col items-center justify-center gap-1.5 border-b border-white/[0.08] px-5 py-2 text-center">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-amber-300">Live assistant test</p>
        <AiBuilderModelSelect
          models={modelChoices}
          value={modelId}
          disabled
          onChange={() => undefined}
        />
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#000000]">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md border border-amber-300/25 bg-[#0a0a0a] px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,.2)]">
            <p>Hi, I’m your AI assistant. Build this project to start testing me with your approved business knowledge.</p>
          </div>
        </div>

        <div className="flex-none border-t border-white/[0.08] p-4 sm:p-5">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-amber-300/25 bg-[#0a0a0a] p-2 shadow-[0_12px_32px_rgba(0,0,0,.22)]">
            <textarea
              rows={2}
              disabled
              placeholder="Ask about services, pricing, policies, or the business..."
              className="min-h-[52px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              disabled
              className="min-h-[52px] rounded-xl border border-amber-300/15 bg-[#080808] px-4 text-sm font-black text-white opacity-40"
            >
              Send
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">Chat is disabled until your AI is built.</p>
        </div>
      </section>
    </div>
  );
}

export default function AiBuilderEmptyWorkspace({ builder, error = null, onChange, onBuild }: Props) {
  const router = useRouter();
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const rememberedProjectId = readRememberedProjectId();

    if (rememberedProjectId) {
      setExistingProjectId(rememberedProjectId);
      router.prefetch(`/ai-builder?projectId=${encodeURIComponent(rememberedProjectId)}&tab=dashboard`);
      void warmAiBuilderProjectResponse(rememberedProjectId);
    }

    fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { projects?: ProjectSummary[] };
        const activeProjects = Array.isArray(payload.projects)
          ? payload.projects.filter((project) => !project.archivedAt)
          : [];
        if (!activeProjects.length) return null;

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
        if (cancelled) return;
        setExistingProjectId(projectId);
        if (projectId) {
          router.prefetch(`/ai-builder?projectId=${encodeURIComponent(projectId)}&tab=dashboard`);
          void warmAiBuilderProjectResponse(projectId);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function showFirstProjectRequired() {
    const goToBuilder = await showConfirm({
      title: "Create your first project",
      message: "Build your first AI project to access the rest of the workspace.",
      cancelLabel: "Cancel",
      confirmLabel: "Go to Brain Builder",
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
    router.push(
      `/ai-builder?projectId=${encodeURIComponent(existingProjectId)}&tab=${encodeURIComponent(tab)}${review}`,
      { scroll: false },
    );
  }

  return (
    <AiBuilderWorkspaceFrame
      title="Brain Builder"
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
      <div className="ai-builder-form w-full">
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
