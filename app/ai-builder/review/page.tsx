import { redirect } from "next/navigation";
import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";

type WorkspaceTab = "dashboard" | "insights" | "overview" | "sources" | "settings";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
    returnTab?: string | string[];
  };
};

const WORKSPACE_TABS = new Set<WorkspaceTab>([
  "dashboard",
  "insights",
  "overview",
  "sources",
  "settings",
]);

export default function Page({ searchParams }: PageProps) {
  const { projectId, returnTab } = searchParams;
  const normalizedProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const requestedReturnTab = Array.isArray(returnTab) ? returnTab[0] : returnTab;
  const initialTab = WORKSPACE_TABS.has(requestedReturnTab as WorkspaceTab)
    ? (requestedReturnTab as WorkspaceTab)
    : "dashboard";

  if (!normalizedProjectId) {
    redirect("/ai-builder");
  }

  return (
    <AiBuilderProjectWorkspace
      projectId={normalizedProjectId}
      reviewOpen
      initialTab={initialTab}
    />
  );
}
