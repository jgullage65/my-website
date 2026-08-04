import AiBuilderProjectWorkspace from "@/app/components/ai-builder/AiBuilderProjectWorkspace";
import RememberAiBuilderProject from "@/app/components/ai-builder/RememberAiBuilderProject";
import { toInternalProjectId } from "@/app/lib/brain-builder-public-id";

type PageProps = { params: { buildId: string } };

export default function Page({ params }: PageProps) {
  const projectId = toInternalProjectId(decodeURIComponent(params.buildId));
  return <><RememberAiBuilderProject projectId={projectId} /><AiBuilderProjectWorkspace projectId={projectId} initialTab="settings" /></>;
}
