"use client";

import type { KnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import AiBuilderDashboard from "./AiBuilderDashboard";
import AiBuilderDemoChat from "./AiBuilderDemoChat";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderProjectInsights, { type ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderReview from "./AiBuilderReview";
import type { BuilderState, ReviewCommandPending } from "./AiBuilderClient";

export type AiBuilderWorkspaceViewName = "dashboard" | "builder" | "review" | "insights" | "chat";

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
  pendingReviewItems?: ReviewCommandPending;
  embeddedReview?: boolean;
  dashboardShowcase?: boolean;
  previewMode?: boolean;
  showLaunchChat?: boolean;
  onBuilderChange?: (builder: BuilderState) => void;
  onBuild?: () => void;
  onReviewCommand?: (command: ReviewCommandRequest) => Promise<void>;
  onBack?: () => void;
  onLaunchChat?: () => void;
};

const noop = () => undefined;
const noopAsync = async () => undefined;

export default function AiBuilderWorkspaceView(props: AiBuilderWorkspaceViewProps) {
  const demo = props.mode === "demo";
  const preview = props.mode === "preview";
  const inert = demo ? "pointer-events-none" : "";

  if (props.activeView === "dashboard") {
    return <AiBuilderDashboard showcase={props.dashboardShowcase} />;
  }

  if (props.activeView === "builder") {
    const previewClassName = props.previewMode
      ? "h-full overflow-hidden [&>div]:pb-0 [&>div]:px-0 [&>div>div]:rounded-none [&>div>div]:border-0 [&>div>div]:shadow-none"
      : "";
    return <div className={`${inert} ${previewClassName}`}><AiBuilderForm value={props.builder} projectId={demo || preview ? null : props.projectId} onChange={demo ? noop : props.onBuilderChange ?? noop} onBuild={demo ? noop : props.onBuild ?? noop} demoMode={demo || preview} /></div>;
  }

  if (props.activeView === "review") {
    return <div className={inert}><AiBuilderReview onReviewCommand={demo ? noopAsync : props.onReviewCommand ?? noopAsync} pendingReviewItems={props.pendingReviewItems ?? new Set()} onBack={demo ? noop : props.onBack ?? noop} onLaunchChat={demo ? noop : props.onLaunchChat ?? noop} showLaunchChat={demo || preview ? false : props.showLaunchChat} embedded={props.embeddedReview} /></div>;
  }

  if (props.activeView === "insights") {
    return <AiBuilderProjectInsights />;
  }

  if (!props.knowledge) return null;
  return <div className={inert}><AiBuilderDemoChat knowledge={props.knowledge} projectId={props.projectId ?? props.session.id} chatThread={props.chatThread ?? null} onBack={demo ? noop : props.onBack ?? noop} demoMode={demo} previewMode={preview} /></div>;
}
