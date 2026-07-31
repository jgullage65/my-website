"use client";

import { useEffect } from "react";

const COOKIE_NAME = "ai_builder_last_project";

export default function RememberAiBuilderProject({ projectId }: { projectId: string }) {
  useEffect(() => {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(projectId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [projectId]);

  useEffect(() => {
    const openProjectDashboard = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href^="/ai-builder?projectId="]');
      if (!link) return;

      const url = new URL(link.href, window.location.origin);
      if (url.searchParams.get("tab") !== "dashboard") return;

      event.preventDefault();
      window.location.assign(url.toString());
    };

    document.addEventListener("click", openProjectDashboard, true);
    return () => document.removeEventListener("click", openProjectDashboard, true);
  }, []);

  return null;
}
