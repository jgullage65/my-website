"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AiBuilderClient from "./AiBuilderClient";

export default function AiBuilderNewProjectFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const step = searchParams.get("step");

  useEffect(() => {
    if (!projectId || step !== "results") return;

    router.replace(`/ai-builder?projectId=${encodeURIComponent(projectId)}`);
  }, [projectId, router, step]);

  return <AiBuilderClient />;
}
