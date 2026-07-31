import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AiBuilderLanding from "@/app/components/ai-builder/AiBuilderLanding";
import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import AiBuilderShell from "@/app/components/ai-builder/AiBuilderShell";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
  };
};

export default async function Page({ searchParams }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    return (
      <AiBuilderShell>
        <AiBuilderLanding />
      </AiBuilderShell>
    );
  }

  const projects = await listAiBuilderProjects();
  const activeProjects = projects.filter((project) => !project.archivedAt);

  if (!activeProjects.length) {
    redirect("/ai-builder?new=1");
  }

  const requestedProjectId = Array.isArray(searchParams.projectId)
    ? searchParams.projectId[0]
    : searchParams.projectId;
  const selectedProject =
    activeProjects.find((project) => project.id === requestedProjectId) ?? activeProjects[0];

  return <AiBuilderProjectWorkspace projectId={selectedProject.id} initialTab="projects" />;
}
