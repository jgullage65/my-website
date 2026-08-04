"use client";

import { useMemo, useState } from "react";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type { PersistedWebsiteKnowledge } from "@/app/lib/ai-engine/knowledge/websiteKnowledge";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type { BuilderState } from "./AiBuilderClient";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderProgress from "./AiBuilderProgress";
import AiBuilderWorkspaceFrame from "./AiBuilderWorkspaceFrame";
import AiBuilderWorkspaceView, { type AiBuilderWorkspaceViewName } from "./AiBuilderWorkspaceView";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { buildDeterministicBusinessBrain } from "@/app/lib/ai-engine/deterministic";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

type Props = {
  session: AiBuilderSession;
  builder: BuilderState;
  diagnostics?: ProjectDiagnostics | null;
  onClose: () => void;
};

type DemoTab = "builder" | "dashboard" | "insights" | "review" | "sources" | "settings" | "chat";
type BuildStage = "idle" | "building" | "ready";

const ITEMS: ReadonlyArray<readonly [DemoTab, string]> = [
  ["builder", "Brain Builder"],
  ["dashboard", "Dashboard"],
  ["insights", "Project Insights"],
  ["review", "Business Knowledge"],
  ["sources", "Sources"],
  ["settings", "Settings"],
  ["chat", "Assistant"],
];

const EMPTY_BUILDER: BuilderState = {
  businessName: "",
  industry: "",
  website: "",
  tone: "Professional",
  userKnowledge: {
    productsServices: "",
    idealCustomers: "",
    additionalKnowledge: "",
  },
  websiteKnowledge: null,
  crawlAttemptIds: [],
};

function updatePreviewSession(session: AiBuilderSession, command: ReviewCommandRequest): AiBuilderSession {
  const now = new Date().toISOString();
  const nextContextEntries = session.contextEntries.map((entry) => {
    if (command.itemKind !== "context_entry" || entry.id !== command.itemId) return entry;
    if (command.kind === "approve" || command.kind === "restore") return { ...entry, status: "approved" as const, updatedAt: now };
    if (command.kind === "archive" || command.kind === "reject") return { ...entry, status: "archived" as const, updatedAt: now };
    if (command.kind === "unapprove") return { ...entry, status: "proposed" as const, updatedAt: now };
    return {
      ...entry,
      title: command.correction.title ?? entry.title,
      content: command.correction.content,
      status: "corrected" as const,
      updatedAt: now,
      metadata: { ...entry.metadata, userEdited: true },
    };
  });

  const nextFaqEntries = session.faqEntries.map((faq) => {
    if (command.itemKind !== "faq" || faq.id !== command.itemId) return faq;
    if (command.kind === "approve" || command.kind === "restore") return { ...faq, status: "approved" as const, updatedAt: now };
    if (command.kind === "archive" || command.kind === "reject") return { ...faq, status: "archived" as const, updatedAt: now };
    if (command.kind === "unapprove") return { ...faq, status: "proposed" as const, updatedAt: now };
    return {
      ...faq,
      question: command.correction.question,
      answer: command.correction.answer,
      status: "corrected" as const,
      updatedAt: now,
    };
  });

  const allItems = [...nextContextEntries, ...nextFaqEntries];
  const approved = allItems.filter((item) => item.status === "approved" || item.status === "corrected").length;
  const proposed = allItems.filter((item) => item.status === "proposed").length;
  const archived = allItems.filter((item) => item.status === "archived").length;

  return {
    ...session,
    contextEntries: nextContextEntries,
    faqEntries: nextFaqEntries,
    contextCounts: {
      ...session.contextCounts,
      total: allItems.length,
      approved,
      proposed,
      archived,
    },
    governanceRevision: (session.governanceRevision ?? 0) + 1,
    updatedAt: now,
  };
}

function businessLabel(builder: BuilderState): string {
  return builder.businessName.trim() || "New Project";
}

export default function AiBuilderDeterministicDemoWorkspace({ session, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DemoTab>("builder");
  const [builderValue, setBuilderValue] = useState<BuilderState>(EMPTY_BUILDER);
  const [previewSession, setPreviewSession] = useState(session);
  const [buildStage, setBuildStage] = useState<BuildStage>("idle");
  const [buildPercent, setBuildPercent] = useState(0);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const knowledge = useMemo(() => buildKnowledgePack(previewSession), [previewSession]);
  const currentBusiness = businessLabel(builderValue);
  const projectReady = buildStage === "ready";

  const websiteKnowledge = useMemo<PersistedWebsiteKnowledge | null>(() => {
    const website = builderValue.websiteKnowledge;
    if (!website) return null;
    return {
      schema_version: 2,
      document_version: 1,
      current_crawl_attempt_id: website.crawlAttemptId ?? null,
      imported_at: website.importedAt,
      requested_url: website.requestedUrl,
      resolved_url: website.resolvedUrl,
      pages: website.pages,
      warnings: website.warnings,
      knowledge: website.knowledge ?? {
        facts: [],
        coverage: {} as PersistedWebsiteKnowledge["knowledge"]["coverage"],
        unresolvedQuestions: [],
      },
      source_documents: website.sourceDocuments,
      source_blocks: website.sourceBlocks,
    };
  }, [builderValue.websiteKnowledge]);

  const demoDiagnostics = useMemo<ProjectDiagnostics>(() => {
    if (!projectReady) return { crawls: [], generations: [] };
    const completedAt = previewSession.updatedAt ?? new Date().toISOString();
    const pageCount = websiteKnowledge?.pages.length ?? 0;
    return {
      crawls: websiteKnowledge
        ? [{
            attempt_number: 1,
            status: "completed",
            started_at: websiteKnowledge.imported_at,
            completed_at: completedAt,
            pages_discovered: pageCount,
            pages_processed: pageCount,
            pages_skipped: 0,
            pages_failed: 0,
            duration_ms: 1800,
          }]
        : [],
      generations: [{
        attempt_number: 1,
        status: "completed",
        started_at: completedAt,
        completed_at: completedAt,
        knowledge_count: previewSession.contextEntries.length,
        faq_count: previewSession.faqEntries.length,
        model: "Brain Builder demo",
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        retry_count: 0,
        duration_ms: 2400,
      }],
    };
  }, [previewSession, projectReady, websiteKnowledge]);

  const requireProject = async () => {
    await showConfirm({
      title: "Create a project first",
      message: "Complete Brain Builder so this workspace can use your business information.",
      confirmLabel: "Go to Brain Builder",
      cancelLabel: "Cancel",
    });
    setActiveTab("builder");
  };

  const selectTab = (nextTab: DemoTab) => {
    if (!projectReady && nextTab !== "builder" && nextTab !== "settings") {
      void requireProject();
      return;
    }
    setActiveTab(nextTab);
  };

  const buildTemporaryBrain = async () => {
    if (buildStage === "building") return;
    setBuildStage("building");
    setBuildPercent(8);

    for (const percent of [18, 31, 46, 61, 74, 86, 94]) {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      setBuildPercent(percent);
    }

    const website = builderValue.websiteKnowledge;
    const result = buildDeterministicBusinessBrain({
      sessionId: `demo_${crypto.randomUUID()}`,
      pages: website?.pages,
      sourceDocuments: website?.sourceDocuments,
      sourceBlocks: website?.sourceBlocks,
      owner: {
        businessName: builderValue.businessName,
        industry: builderValue.industry,
        productsServices: builderValue.userKnowledge.productsServices,
        idealCustomers: builderValue.userKnowledge.idealCustomers,
        additionalKnowledge: builderValue.userKnowledge.additionalKnowledge,
        policiesOperations: (builderValue.userKnowledge as typeof builderValue.userKnowledge & { businessPoliciesOperations?: string }).businessPoliciesOperations,
        caseStudiesTestimonials: (builderValue.userKnowledge as typeof builderValue.userKnowledge & { successStoriesCaseStudies?: string }).successStoriesCaseStudies,
        tone: builderValue.tone,
      },
    });

    if (result.session) setPreviewSession(result.session);
    setBuildPercent(100);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setBuildStage("ready");
    setActiveTab("review");
  };

  const activeView: AiBuilderWorkspaceViewName = activeTab;
  const title = ITEMS.find(([value]) => value === activeTab)?.[1] ?? "Brain Builder";

  const mainContent = buildStage === "building" ? (
    <AiBuilderProgress
      builder={builderValue}
      session={null}
      complete={false}
      percent={buildPercent}
      onReview={() => undefined}
    />
  ) : (
    <AiBuilderWorkspaceView
      mode={activeTab === "chat" ? "live" : "preview"}
      activeView={activeView}
      session={previewSession}
      builder={builderValue}
      websiteKnowledge={websiteKnowledge}
      diagnostics={demoDiagnostics}
      knowledge={knowledge}
      projectId={previewSession.id}
      embeddedReview
      settingsReadOnly
      onBuilderChange={setBuilderValue}
      onBuild={() => void buildTemporaryBrain()}
      onReviewCommand={async (command) => setPreviewSession((current) => updatePreviewSession(current, command))}
      onBack={() => setActiveTab("dashboard")}
      onLaunchChat={() => setActiveTab("chat")}
      showLaunchChat
    />
  );

  const rightRail = projectReady ? (
    <AiBuilderWorkspaceView
      mode="live"
      activeView="chat"
      session={previewSession}
      builder={builderValue}
      websiteKnowledge={websiteKnowledge}
      diagnostics={demoDiagnostics}
      knowledge={knowledge}
      projectId={previewSession.id}
      onBack={() => setActiveTab("dashboard")}
    />
  ) : (
    <div className="flex h-full items-center justify-center px-7 text-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Assistant</p>
        <p className="mt-3 text-sm leading-6 text-slate-400">Create your project to test an assistant trained on your business.</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[220] bg-[#020202]">
      {confirmDialogNode}
      <button type="button" onClick={onClose} aria-label="Close demo" className="fixed right-4 top-4 z-[240] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl text-white transition hover:border-amber-300/40 hover:bg-[#111111]">×</button>
      <AiBuilderWorkspaceFrame
        title={`${title} · ${currentBusiness}`}
        onBuilderSelect={() => setActiveTab("builder")}
        builderActive={activeTab === "builder"}
        items={ITEMS.filter(([value]) => value !== "builder").map(([value, label]) => ({
          value,
          label,
          active: activeTab === value,
          mobileOnly: value === "chat",
          onSelect: () => selectTab(value),
        }))}
        rightRail={rightRail}
      >
        {mainContent}
      </AiBuilderWorkspaceFrame>
    </div>
  );
}
