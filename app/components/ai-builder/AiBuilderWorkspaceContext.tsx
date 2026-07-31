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

type AiBuilderWorkspaceProject = {
  businessName: string;
  industry: string;
  website: string;
  tone: string;
  stateRevision: number;
};

type AiBuilderWorkspaceContextValue = {
  projectId: string;
  project: AiBuilderWorkspaceProject;
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
  renameProject: (businessName: string) => Promise<void>;
};

const AiBuilderWorkspaceContext = createContext<AiBuilderWorkspaceContextValue | null>(null);

type ProviderProps = Omit<AiBuilderWorkspaceContextValue, "project" | "renameProject"> & {
  children: ReactNode;
  project?: AiBuilderWorkspaceProject;
  renameProject?: (businessName: string) => Promise<void>;
};

const unavailableRename = async () => {
  throw new Error("Project renaming is not available in this workspace view.");
};

export function AiBuilderWorkspaceProvider({
  children,
  projectId,
  project,
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
  renameProject = unavailableRename,
}: ProviderProps) {
  const resolvedProject = useMemo<AiBuilderWorkspaceProject>(
    () => project ?? ({
      businessName: "",
      industry: "",
      website: "",
      tone: session.assistantConfiguration.tone,
      stateRevision: 0,
    }),
    [project, session.assistantConfiguration.tone],
  );

  const value = useMemo<AiBuilderWorkspaceContextValue>(
    () => ({
      projectId,
      project: resolvedProject,
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
      renameProject,
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
      renameProject,
      resolvedProject,
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
