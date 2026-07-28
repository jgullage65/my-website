import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
  };
};

export default function Page({ searchParams }: PageProps) {
  const { projectId } = searchParams;
  const normalizedProjectId = Array.isArray(projectId) ? projectId[0] : projectId;

  if (!normalizedProjectId) {
    return <AiBuilderProjectWorkspace projectId="" reviewOpen />;
  }

  return <AiBuilderProjectWorkspace projectId={normalizedProjectId} reviewOpen />;
}
