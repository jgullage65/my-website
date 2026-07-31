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

export default function AiBuilderEmptyWorkspace({ builder, error = null, onChange, onBuild }: Props) {
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json() as { projects?: ProjectSummary[] };
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
      document.querySelector<HTMLElement>(".ai-builder-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openWorkspace(value: string) {
    if (!existingProjectId) {
      void showFirstProjectRequired();
      return;
    }

    const tab = value === "knowledge" ? "dashboard" : value;
    const review = value === "knowledge" ? "&review=1" : "";
    window.location.assign(`/ai-builder?projectId=${encodeURIComponent(existingProjectId)}&tab=${encodeURIComponent(tab)}${review}`);
  }

  return (
    <AiBuilderWorkspaceFrame
      title="AI Builder"
      builderActive
      onBuilderSelect={() => {
        document.querySelector<HTMLElement>(".ai-builder-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      items={WORKSPACE_ITEMS.map(([value, label]) => ({
        value,
        label,
        onSelect: () => openWorkspace(value),
      }))}
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
