import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import RememberAiBuilderProject from "@/app/components/ai-builder/RememberAiBuilderProject";

type PageProps = {
  params: {
    buildId: string;
  };
};

export default function Page({ params }: PageProps) {
  const buildId = decodeURIComponent(params.buildId);

  return (
    <>
      <RememberAiBuilderProject projectId={buildId} />
      <AiBuilderProjectWorkspace projectId={buildId} initialTab="insights" />
    </>
  );
}
