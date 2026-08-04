import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AiBuilderFirstRun from "@/app/components/ai-builder/AiBuilderFirstRun";
import AiBuilderLanding from "@/app/components/ai-builder/AiBuilderLanding";
import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import AiBuilderShell from "@/app/components/ai-builder/AiBuilderShell";
import RememberAiBuilderProject from "@/app/components/ai-builder/RememberAiBuilderProject";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";

const LAST_PROJECT_COOKIE = "ai_builder_last_project";

export default async function Page() {
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
    return <AiBuilderFirstRun />;
  }

  const rememberedProjectId = cookies().get(LAST_PROJECT_COOKIE)?.value;
  const rememberedProject = rememberedProjectId
    ? activeProjects.find((project) => project.id === rememberedProjectId)
    : undefined;
  const fallbackProject = [...activeProjects].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })[0];
  const project = rememberedProject ?? fallbackProject;

  redirect(`/brain-builder/dashboard/${encodeURIComponent(project.id)}`);
}
