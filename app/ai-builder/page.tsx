import AiBuilderClient from "@/app/components/ai-builder/AiBuilderClient";
import AiBuilderProjects from "@/app/components/ai-builder/AiBuilderProjects";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
    new?: string | string[];
  };
};

export default function Page({ searchParams }: PageProps) {
  const { projectId, new: newProject } = searchParams;
  const normalizedProjectId = Array.isArray(projectId) ? projectId[0] : projectId;

  if (!normalizedProjectId && !newProject) return <AiBuilderProjects />;

  return (
    <AiBuilderClient
      initialProjectId={normalizedProjectId}
    />
  );
}
