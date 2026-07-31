import { redirect } from "next/navigation";

type PageProps = {
  searchParams: {
    projectId?: string | string[];
  };
};

export default function Page({ searchParams }: PageProps) {
  const projectId = Array.isArray(searchParams.projectId)
    ? searchParams.projectId[0]
    : searchParams.projectId;

  if (projectId) {
    redirect(
      `/ai-builder?projectId=${encodeURIComponent(projectId)}&tab=projects`,
    );
  }

  redirect("/ai-builder?tab=projects");
}
