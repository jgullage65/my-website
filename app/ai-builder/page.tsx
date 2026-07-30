import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AiBuilderClient from "@/app/components/ai-builder/AiBuilderClient";
import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";

type WorkspaceTab = "projects" | "dashboard" | "insights" | "overview" | "sources" | "settings";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
    new?: string | string[];
    tab?: string | string[];
  };
};

const WORKSPACE_TABS = new Set<WorkspaceTab>([
  "projects",
  "dashboard",
  "insights",
  "overview",
  "sources",
  "settings",
]);

export default async function Page({ searchParams }: PageProps) {
  const { projectId, new: newProject, tab } = searchParams;
  const normalizedProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;
  const initialTab = WORKSPACE_TABS.has(requestedTab as WorkspaceTab)
    ? (requestedTab as WorkspaceTab)
    : "dashboard";

  if (normalizedProjectId) {
    return <AiBuilderProjectWorkspace projectId={normalizedProjectId} initialTab={initialTab} />;
  }

  if (newProject) {
    return <AiBuilderClient />;
  }

  const { userId } = await auth();
  if (!userId) {
    return <AiBuilderClient />;
  }

  const projects = await listAiBuilderProjects();
  if (!projects.length) {
    redirect("/ai-builder?new=1");
  }

  const firstActiveProject = projects.find((project) => !project.archivedAt) ?? projects[0];
  redirect(`/ai-builder?projectId=${encodeURIComponent(firstActiveProject.id)}&tab=projects`);
}
