"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import AiBuilderKnowledgeInspector from "./AiBuilderKnowledgeInspector";
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

export type AiBuilderWorkspaceProject = {
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
  pendingReviewItems: ReadonlySet<string>;
  submitReviewCommand: (command: ReviewCommandRequest) => Promise<void>;
  setActiveTab: (tab: AiBuilderWorkspaceTab) => void;
  openOverview: () => void;
  closeOverview: () => void;
  openKnowledge: () => void;
  closeKnowledge: () => void;
  renameProject: (businessName: string) => Promise<void>;
};

const AiBuilderWorkspaceContext = createContext<AiBuilderWorkspaceContextValue | null>(null);

type ProviderProps = AiBuilderWorkspaceContextValue & {
  children: ReactNode;
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
  pendingReviewItems,
  submitReviewCommand,
  setActiveTab,
  openOverview,
  closeOverview,
  openKnowledge,
  closeKnowledge,
  renameProject,
}: ProviderProps) {
  const value = useMemo<AiBuilderWorkspaceContextValue>(
    () => ({
      projectId,
      project,
      session,
      websiteKnowledge,
      diagnostics,
      messages,
      activeTab,
      overviewOpen,
      knowledgeOpen,
      pendingReviewItems,
      submitReviewCommand,
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
      pendingReviewItems,
      project,
      projectId,
      renameProject,
      session,
      setActiveTab,
      submitReviewCommand,
      websiteKnowledge,
    ],
  );

  return (
    <AiBuilderWorkspaceContext.Provider value={value}>
      {children}
      {knowledgeOpen ? (
        <div className="fixed left-[calc(50%-390px)] top-[calc(5dvh+16px)] z-[125] hidden xl:block [&>button]:!static [&>button]:!left-auto [&>button]:!top-auto [&>button]:!translate-x-0">
          <AiBuilderKnowledgeInspector />
        </div>
      ) : null}
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
