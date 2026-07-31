import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AiBuilderClient from "@/app/components/ai-builder/AiBuilderClient";
import AiBuilderLanding from "@/app/components/ai-builder/AiBuilderLanding";
import AiBuilderProjects from "@/app/components/ai-builder/AiBuilderProjects";
import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import AiBuilderShell from "@/app/components/ai-builder/AiBuilderShell";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";

type WorkspaceTab = "projects" | "dashboard" | "insights" | "overview" | "sources" | "settings";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
    new?: string | string[];
    tab?: string | string[];
    review?: string | string[];
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
  const { projectId, new: newProject, tab, review } = searchParams;
  const normalizedProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;
  const requestedReview = Array.isArray(review) ? review[0] : review;
  const initialTab = WORKSPACE_TABS.has(requestedTab as WorkspaceTab)
    ? (requestedTab as WorkspaceTab)
    : "dashboard";
  const { userId } = await auth();

  if (!userId) {
    return (
      <AiBuilderShell>
        <AiBuilderLanding />
      </AiBuilderShell>
    );
  }

  if (normalizedProjectId) {
    return (
      <AiBuilderProjectWorkspace
        projectId={normalizedProjectId}
        initialTab={initialTab}
        reviewOpen={requestedReview === "1" || requestedReview === "true"}
      />
    );
  }

  if (newProject) {
    return <AiBuilderClient />;
  }

  const projects = await listAiBuilderProjects();
  const activeProjects = projects.filter((project) => !project.archivedAt);

  if (!activeProjects.length) {
    redirect("/ai-builder?new=1");
  }

  return <AiBuilderProjects />;
}
