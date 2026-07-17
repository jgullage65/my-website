import AiBuilderClient from "@/app/components/ai-builder/AiBuilderClient";

type PageProps = {
  searchParams: Promise<{
    projectId?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const { projectId } = await searchParams;

  return (
    <AiBuilderClient
      initialProjectId={Array.isArray(projectId) ? projectId[0] : projectId}
    />
  );
}
