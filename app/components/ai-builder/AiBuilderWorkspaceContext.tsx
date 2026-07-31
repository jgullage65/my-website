"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AiBuilderWorkspaceTab =
  | "projects"
  | "dashboard"
  | "insights"
  | "overview"
  | "knowledge"
  | "sources"
  | "settings";

type AiBuilderWorkspaceContextValue = {
  projectId: string;
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
      knowledgeOpen,
      openKnowledge,
      openOverview,
      overviewOpen,
      projectId,
      setActiveTab,
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
