"use client";

import { useEffect } from "react";
import AiBuilderClient from "./AiBuilderClient";

export default function AiBuilderFirstRun() {
  useEffect(() => {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    let navigating = false;

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      originalReplaceState(data, unused, url);

      if (navigating) return;
      const nextUrl = new URL(url?.toString() ?? window.location.href, window.location.href);
      const projectId = nextUrl.searchParams.get("projectId");
      if (!projectId) return;

      navigating = true;
      window.location.assign(
        `/brain-builder/overview/${encodeURIComponent(projectId)}`,
      );
    }) as History["replaceState"];

    return () => {
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return <AiBuilderClient />;
}
