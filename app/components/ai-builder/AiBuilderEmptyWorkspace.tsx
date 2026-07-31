"use client";

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

const WORKSPACE_ITEMS = [
  "Projects",
  "Dashboard",
  "Project Insights",
  "Overview",
  "Business Knowledge",
  "Sources",
  "Settings",
] as const;

export default function AiBuilderEmptyWorkspace({ builder, error = null, onChange, onBuild }: Props) {
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

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

  return (
    <AiBuilderWorkspaceFrame
      title="AI Builder"
      builderActive
      onBuilderSelect={() => {
        document.querySelector<HTMLElement>(".ai-builder-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      items={WORKSPACE_ITEMS.map((label) => ({
        value: label.toLowerCase().replaceAll(" ", "-"),
        label,
        onSelect: () => void showFirstProjectRequired(),
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
