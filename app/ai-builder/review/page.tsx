import { redirect } from "next/navigation";

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

  redirect(
    `/ai-builder?projectId=${encodeURIComponent(normalizedProjectId)}&tab=${initialTab}&review=1`,
  );
}
