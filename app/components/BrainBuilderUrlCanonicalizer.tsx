"use client";

import { useEffect } from "react";
import { toPublicBuildId } from "@/app/lib/brain-builder-public-id";

const TAB_ROUTES: Record<string, string> = {
  dashboard: "dashboard",
  insights: "insights",
  overview: "overview",
  sources: "sources",
  settings: "settings",
};

function canonicalize(input: string | URL | null | undefined): string | URL | null | undefined {
  if (!input) return input;

  const url = new URL(input.toString(), window.location.origin);
  if (!url.pathname.startsWith("/brain-builder")) return input;

  const projectId = url.searchParams.get("projectId");
  const tab = url.searchParams.get("tab");

  if (projectId && tab === "projects") {
    url.pathname = "/brain-builder/projects";
    url.search = "";
    return url.toString();
  }

  if (projectId && tab && TAB_ROUTES[tab]) {
    url.pathname = `/brain-builder/${TAB_ROUTES[tab]}/${encodeURIComponent(toPublicBuildId(projectId))}`;
    url.search = "";
    return url.toString();
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 3 && segments[0] === "brain-builder") {
    const cleanId = toPublicBuildId(decodeURIComponent(segments[2]));
    if (cleanId !== decodeURIComponent(segments[2])) {
      url.pathname = `/brain-builder/${segments[1]}/${encodeURIComponent(cleanId)}`;
      url.search = "";
      return url.toString();
    }
  }

  return input;
}

export default function BrainBuilderUrlCanonicalizer() {
  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      originalPushState(data, unused, canonicalize(url));
    }) as History["pushState"];

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      originalReplaceState(data, unused, canonicalize(url));
    }) as History["replaceState"];

    const current = canonicalize(window.location.href);
    if (typeof current === "string" && current !== window.location.href) {
      originalReplaceState(null, "", current);
    }

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
