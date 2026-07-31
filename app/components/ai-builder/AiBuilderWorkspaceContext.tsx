"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";

export type AiBuilderWorkspaceTab =
  | "projects"
  | "dashboard"
  | "insights"
  | "overview"
  | "knowledge"
  | "sources"
  | "settings";

type AiBuilderWorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  createdAt: string;
};

type AiBuilderWorkspaceContextValue = {
  projectId: string;
  session: AiBuilderSession;
  websiteKnowledge: PersistedWebsiteKnowledge | null;
  diagnostics: ProjectDiagnostics | null;
  messages: AiBuilderWorkspaceMessage[];
  activeTab: AiBuilderWorkspaceTab;
  overviewOpen: boolean;
  knowledgeOpen: boolean;
  setActiveTab: (tab: AiBuilderWorkspaceTab) => void;
  openOverview: () => void;
  closeOverview: () => void;
  openKnowledge: () => void;
  closeKnowledge: () => void;
};

const AiBuilderWorkspaceContext = createContext<AiBuilderWorkspaceContextValue | null>(null);

type ProviderProps = AiBuilderWorkspaceContextValue & {
  children: ReactNode;
};

export function AiBuilderWorkspaceProvider({
  children,
  projectId,
  session,
  websiteKnowledge,
  diagnostics,
  messages,
  activeTab,
  overviewOpen,
  knowledgeOpen,
  setActiveTab,
  openOverview,
  closeOverview,
  openKnowledge,
  closeKnowledge,
}: ProviderProps) {
  const value = useMemo<AiBuilderWorkspaceContextValue>(
    () => ({
      projectId,
      session,
      websiteKnowledge,
      diagnostics,
      messages,
      activeTab,
      overviewOpen,
      knowledgeOpen,
      setActiveTab,
      openOverview,
      closeOverview,
      openKnowledge,
      closeKnowledge,
    }),
    [
      activeTab,
      closeKnowledge,
      closeOverview,
      diagnostics,
      knowledgeOpen,
      messages,
      openKnowledge,
      openOverview,
      overviewOpen,
      projectId,
      session,
      setActiveTab,
      websiteKnowledge,
    ],
  );

  return (
    <AiBuilderWorkspaceContext.Provider value={value}>
      {children}
    </AiBuilderWorkspaceContext.Provider>
  );
}

export function useAiBuilderWorkspace() {
  const context = useContext(AiBuilderWorkspaceContext);

  if (!context) {
    throw new Error("useAiBuilderWorkspace must be used inside AiBuilderWorkspaceProvider.");
  }

  return context;
}
