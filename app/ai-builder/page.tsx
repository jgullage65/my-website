import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AiBuilderClient from "@/app/components/ai-builder/AiBuilderClient";
import AiBuilderLanding from "@/app/components/ai-builder/AiBuilderLanding";
import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import AiBuilderShell from "@/app/components/ai-builder/AiBuilderShell";
import RememberAiBuilderProject from "@/app/components/ai-builder/RememberAiBuilderProject";
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

const LAST_PROJECT_COOKIE = "ai_builder_last_project";

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

  if (newProject) {
    return <AiBuilderClient />;
  }

  if (normalizedProjectId) {
    return (
      <>
        <RememberAiBuilderProject projectId={normalizedProjectId} />
        <AiBuilderProjectWorkspace
          projectId={normalizedProjectId}
          initialTab={initialTab}
          reviewOpen={requestedReview === "1" || requestedReview === "true"}
        />
      </>
    );
  }

  const projects = await listAiBuilderProjects();
  const activeProjects = projects.filter((project) => !project.archivedAt);

  if (!activeProjects.length) {
    redirect("/ai-builder?new=1");
  }

  const rememberedProjectId = cookies().get(LAST_PROJECT_COOKIE)?.value;
  const rememberedProject = rememberedProjectId
    ? activeProjects.find((project) => project.id === rememberedProjectId)
    : undefined;
  const fallbackProject = [...activeProjects].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })[0];
  const project = rememberedProject ?? fallbackProject;

  redirect(`/ai-builder?projectId=${encodeURIComponent(project.id)}&tab=dashboard`);
}
