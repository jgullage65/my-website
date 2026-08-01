"use client";

import { useEffect } from "react";
import AiBuilderCreationWorkspace from "./AiBuilderCreationWorkspace";

export default function AiBuilderFirstProjectCreation({
  projectsHref,
}: {
  projectsHref: string | null;
}) {
  useEffect(() => {
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      originalReplaceState(data, unused, url);

      const nextUrl = new URL(url?.toString() ?? window.location.href, window.location.href);
      const projectId = nextUrl.searchParams.get("projectId");
      if (!projectId) return;

      window.location.replace(
        `/ai-builder?projectId=${encodeURIComponent(projectId)}&tab=overview`,
      );
    }) as History["replaceState"];

    return () => {
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return <AiBuilderCreationWorkspace projectsHref={projectsHref} />;
}
