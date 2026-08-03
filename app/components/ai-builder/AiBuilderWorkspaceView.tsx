"use client";

import type { KnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import AiBuilderDashboard from "./AiBuilderDashboard";
import AiBuilderDemoChat from "./AiBuilderDemoChat";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderKnowledgeInspector from "./AiBuilderKnowledgeInspector";
import AiBuilderProjectInsights, { type ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderProjects, { type AiBuilderProjectPreview } from "./AiBuilderProjects";
import AiBuilderReview from "./AiBuilderReview";
import AiBuilderSettings from "./AiBuilderSettings";
import AiBuilderSources from "./AiBuilderSources";
import {
  AiBuilderWorkspaceProvider,
  type AiBuilderWorkspaceTab,
} from "./AiBuilderWorkspaceContext";
import type { BuilderState, ReviewCommandPending } from "./AiBuilderClient";
import "./AiBuilderFormOverrides.css";

export type AiBuilderWorkspaceViewName =
  | "dashboard"
  | "builder"
  | "projects"
  | "review"
  | "insights"
  | "sources"
  | "settings"
  | "chat";

type ChatThread = Parameters<typeof AiBuilderDemoChat>[0]["chatThread"];

export type AiBuilderWorkspaceViewProps = {
  mode: "live" | "demo" | "preview";
  activeView: AiBuilderWorkspaceViewName;
  session: AiBuilderSession;
  builder: BuilderState;
  websiteKnowledge?: PersistedWebsiteKnowledge | null;
  diagnostics?: ProjectDiagnostics | null;
  messages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: string[];
    createdAt: string;
  }>;
  knowledge?: KnowledgePack | null;
  chatThread?: ChatThread;
  projectId?: string | null;
  showcaseProjects?: AiBuilderProjectPreview[];
  pendingReviewItems?: ReviewCommandPending;
  embeddedReview?: boolean;
  dashboardShowcase?: boolean;
  previewMode?: boolean;
  settingsReadOnly?: boolean;
  showLaunchChat?: boolean;
  onBuilderChange?: (builder: BuilderState) => void;
  onBuild?: () => void;
  onReviewCommand?: (command: ReviewCommandRequest) => Promise<void>;
  onBack?: () => void;
  onLaunchChat?: () => void;
};

const noop = () => undefined;
const noopAsync = async () => undefined;

function workspaceTabForView(view: AiBuilderWorkspaceViewName): AiBuilderWorkspaceTab {
  if (view === "projects") return "projects";
  if (view === "dashboard") return "dashboard";
  if (view === "insights") return "insights";
  if (view === "review") return "knowledge";
  if (view === "sources") return "sources";
  if (view === "settings") return "settings";
  return "overview";
}

export default function AiBuilderWorkspaceView(props: AiBuilderWorkspaceViewProps) {
  const demo = props.mode === "demo";
  const preview = props.mode === "preview" || props.previewMode === true;
  const inert = demo ? "pointer-events-none" : "";
  const pendingReviewItems = props.pendingReviewItems ?? new Set<string>();
  const submitReviewCommand = demo ? noopAsync : props.onReviewCommand ?? noopAsync;

  let content = null;

  if (props.activeView === "dashboard") {
    content = <AiBuilderDashboard showcase={props.dashboardShowcase} />;
  } else if (props.activeView === "builder") {
    content = (
      <div className={`${inert} ai-builder-form w-full`}>
        <AiBuilderForm
          value={props.builder}
          projectId={props.projectId}
          onChange={props.onBuilderChange ?? noop}
          onBuild={props.onBuild ?? noop}
        />
      </div>
    );
  } else if (props.activeView === "projects") {
    content = (
      <div className={`${inert} h-full min-h-0 overflow-hidden`}>
        <AiBuilderProjects embedded showcaseProjects={props.showcaseProjects ?? []} />
      </div>
    );
  } else if (props.activeView === "review") {
    content = (
      <div className={inert}>
        {!demo && !preview ? <AiBuilderKnowledgeInspector /> : null}
        <AiBuilderReview
          onReviewCommand={submitReviewCommand}
          pendingReviewItems={pendingReviewItems}
          onBack={demo ? noop : props.onBack ?? noop}
          onLaunchChat={demo ? noop : props.onLaunchChat ?? noop}
          showLaunchChat={demo || preview ? false : props.showLaunchChat}
          embedded={props.embeddedReview}
        />
      </div>
    );
  } else if (props.activeView === "insights") {
    content = <AiBuilderProjectInsights />;
  } else if (props.activeView === "sources") {
    content = <AiBuilderSources />;
  } else if (props.activeView === "settings") {
    content = (
      <div className={props.settingsReadOnly ? "pointer-events-none select-none" : undefined}>
        <AiBuilderSettings />
      </div>
    );
  } else if (props.knowledge) {
    content = (
      <div className={inert}>
        <AiBuilderDemoChat
          knowledge={props.knowledge}
          projectId={props.projectId ?? props.session.id}
          chatThread={props.chatThread ?? null}
          onBack={demo ? noop : props.onBack ?? noop}
          demoMode={demo}
          previewMode={preview}
        />
      </div>
    );
  }

  const projectId = props.projectId ?? props.session.id;
  const project = {
    businessName: props.builder.businessName,
    industry: props.builder.industry,
    website: props.builder.website,
    tone: props.builder.tone,
    stateRevision: 0,
  };

  return (
    <AiBuilderWorkspaceProvider
      projectId={projectId}
      project={project}
      session={props.session}
      websiteKnowledge={props.websiteKnowledge ?? null}
      diagnostics={props.diagnostics ?? null}
      messages={props.messages ?? []}
      activeTab={workspaceTabForView(props.activeView)}
      overviewOpen={false}
      knowledgeOpen={props.activeView === "review"}
      pendingReviewItems={pendingReviewItems}
      submitReviewCommand={submitReviewCommand}
      setActiveTab={noop}
      openOverview={noop}
      closeOverview={noop}
      openKnowledge={noop}
      closeKnowledge={noop}
      renameProject={noopAsync}
    >
      {content}
    </AiBuilderWorkspaceProvider>
  );
}
