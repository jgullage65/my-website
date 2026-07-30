import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AiBuilderLanding from "@/app/components/ai-builder/AiBuilderLanding";
import AiBuilderProjectsWorkspace from "@/app/components/ai-builder/AiBuilderProjectsWorkspace";
import AiBuilderShell from "@/app/components/ai-builder/AiBuilderShell";
import { listAiBuilderProjects } from "@/app/lib/db/ai-builder-repository";

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

  if (!projects.length) {
    redirect("/ai-builder?new=1");
  }

  return <AiBuilderProjectsWorkspace />;
}
