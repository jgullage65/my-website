"use client";

import { useEffect } from "react";

const COOKIE_NAME = "ai_builder_last_project";

export default function RememberAiBuilderProject({ projectId }: { projectId: string }) {
  useEffect(() => {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(projectId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [projectId]);

  return null;
}
