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
type DashboardMessages = Parameters<typeof AiBuilderDashboard>[0]["messages"];

export type AiBuilderWorkspaceViewProps = {
  mode: "live" | "demo";
  activeView: AiBuilderWorkspaceViewName;
  session: AiBuilderSession;
  builder: BuilderState;
  websiteKnowledge?: PersistedWebsiteKnowledge | null;
  diagnostics?: ProjectDiagnostics | null;
  messages?: DashboardMessages;
  knowledge?: KnowledgePack | null;
  chatThread?: ChatThread;
  projectId?: string | null;
  pendingReviewItems?: ReviewCommandPending;
  embeddedReview?: boolean;
  showLaunchChat?: boolean;
  onBuilderChange?: (builder: BuilderState) => void;
  onBuild?: () => void;
  onNavigate?: Parameters<typeof AiBuilderDashboard>[0]["onNavigate"];
  onReviewCommand?: (command: ReviewCommandRequest) => Promise<void>;
  onBack?: () => void;
  onLaunchChat?: () => void;
};

const noop = () => undefined;
const noopAsync = async () => undefined;

/**
 * The presentation boundary for every AI Builder workspace surface. Runtime
 * owners provide data and commands; this component never loads, routes, saves,
 * or mutates a project. Demo mode additionally makes command surfaces inert.
 */
export default function AiBuilderWorkspaceView(props: AiBuilderWorkspaceViewProps) {
  const demo = props.mode === "demo";
  const inert = demo ? "pointer-events-none" : "";

  if (props.activeView === "dashboard") {
    return <AiBuilderDashboard session={props.session} websiteKnowledge={props.websiteKnowledge ?? null} messages={props.messages ?? []} diagnostics={props.diagnostics ?? null} onNavigate={demo ? noop : props.onNavigate ?? noop} />;
  }

  if (props.activeView === "builder") {
    return <div className={inert}><AiBuilderForm value={props.builder} projectId={demo ? null : props.projectId} onChange={demo ? noop : props.onBuilderChange ?? noop} onBuild={demo ? noop : props.onBuild ?? noop} demoMode={demo} /></div>;
  }

  if (props.activeView === "review") {
    return <div className={inert}><AiBuilderReview session={props.session} onReviewCommand={demo ? noopAsync : props.onReviewCommand ?? noopAsync} pendingReviewItems={props.pendingReviewItems ?? new Set()} onBack={demo ? noop : props.onBack ?? noop} onLaunchChat={demo ? noop : props.onLaunchChat ?? noop} showLaunchChat={demo ? false : props.showLaunchChat} embedded={props.embeddedReview} /></div>;
  }

  if (props.activeView === "insights") {
    return <AiBuilderProjectInsights session={props.session} diagnostics={props.diagnostics ?? null} messageCount={props.messages?.length ?? props.chatThread?.messages.length ?? 0} />;
  }

  if (!props.knowledge) return null;
  return <div className={inert}><AiBuilderDemoChat knowledge={props.knowledge} projectId={props.projectId ?? props.session.id} chatThread={props.chatThread ?? null} onBack={demo ? noop : props.onBack ?? noop} demoMode={demo} /></div>;
}
