import AiBuilderClient from "@/app/components/ai-builder/AiBuilderClient";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
  };
};

export default function Page({ searchParams }: PageProps) {
  const { projectId } = searchParams;

  return (
    <AiBuilderClient
      initialProjectId={Array.isArray(projectId) ? projectId[0] : projectId}
    />
  );
}
