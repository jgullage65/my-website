"use client";

import { useMemo, useState } from "react";
import { buildKnowledgePack } from "@/app/lib/ai-engine/knowledge";
import type { ReviewCommandRequest } from "@/app/lib/ai-engine/business-memory/review-commands";
import type { BuilderState } from "./AiBuilderClient";
import type { ProjectDiagnostics } from "./AiBuilderProjectInsights";
import AiBuilderWorkspaceFrame from "./AiBuilderWorkspaceFrame";
import AiBuilderWorkspaceView, { type AiBuilderWorkspaceViewName } from "./AiBuilderWorkspaceView";
import type { AiBuilderSession } from "@/app/lib/ai-engine/contracts";
import { assembleDeterministicSession, normalizeOwnerSources, normalizeWebsiteSources } from "@/app/lib/ai-engine/deterministic";

type Props = {
  session: AiBuilderSession;
  builder: BuilderState;
  diagnostics?: ProjectDiagnostics | null;
  onClose: () => void;
};

type DemoTab = "builder" | "dashboard" | "insights" | "overview" | "review" | "sources" | "settings" | "chat";

const ITEMS: ReadonlyArray<readonly [DemoTab, string]> = [
  ["builder", "AI Builder"],
  ["dashboard", "Dashboard"],
  ["insights", "Project Insights"],
  ["overview", "Overview"],
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
  return builder.businessName.trim() || "Your Business";
}

export default function AiBuilderDeterministicDemoWorkspace({ session, diagnostics = null, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DemoTab>("builder");
  const [builderValue, setBuilderValue] = useState<BuilderState>(EMPTY_BUILDER);
  const [previewSession, setPreviewSession] = useState(session);
  const knowledge = useMemo(() => buildKnowledgePack(previewSession), [previewSession]);
  const currentBusiness = businessLabel(builderValue);

  const buildVisitorBrain = () => {
    const owner = builderValue.userKnowledge as BuilderState["userKnowledge"] & { businessPoliciesOperations?: string; successStoriesCaseStudies?: string };
    const ownerSources = normalizeOwnerSources({ businessName: builderValue.businessName, industry: builderValue.industry, productsServices: owner.productsServices, idealCustomers: owner.idealCustomers, policiesOperations: owner.businessPoliciesOperations, successStoriesCaseStudies: owner.successStoriesCaseStudies, additionalKnowledge: owner.additionalKnowledge });
    const websiteSources = builderValue.websiteKnowledge ? normalizeWebsiteSources(builderValue.websiteKnowledge.sourceDocuments ?? [], builderValue.websiteKnowledge.sourceBlocks ?? [], builderValue.websiteKnowledge.pages) : [];
    const result = assembleDeterministicSession({ sessionId: "visitor-demo", sources: [...websiteSources, ...ownerSources], businessName: currentBusiness, tone: builderValue.tone });
    setPreviewSession(result.session);
    setActiveTab("review");
  };

  const activeView: AiBuilderWorkspaceViewName =
    activeTab === "builder"
      ? "builder"
      : activeTab === "dashboard"
        ? "dashboard"
        : activeTab === "insights"
          ? "insights"
          : activeTab === "review"
            ? "review"
            : activeTab === "chat"
              ? "chat"
              : "dashboard";

  const title = ITEMS.find(([value]) => value === activeTab)?.[1] ?? "Demo Workspace";

  const mainContent = activeTab === "sources" ? (
    <section className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-white/[0.08] bg-[#050505] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Website source</p><h2 className="mt-3 text-lg font-semibold text-white">{builderValue.websiteKnowledge ? "Imported website pages" : "Add your website"}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{builderValue.websiteKnowledge ? `Review the website content collected for ${currentBusiness}.` : "Use the AI Builder to import your website and bring your own business into the demo."}</p></article>
      <article className="rounded-2xl border border-white/[0.08] bg-[#050505] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Owner knowledge</p><h2 className="mt-3 text-lg font-semibold text-white">Your business expertise</h2><p className="mt-2 text-sm leading-6 text-slate-400">The details you enter in the builder stay separate from website content so you can clearly review both.</p></article>
    </section>
  ) : activeTab === "settings" ? (
    <section className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-white/[0.08] bg-[#050505] p-5"><p className="text-sm font-semibold text-white">Assistant tone</p><p className="mt-2 text-sm text-slate-400">{builderValue.tone || "Professional"}</p></article>
      <article className="rounded-2xl border border-white/[0.08] bg-[#050505] p-5"><p className="text-sm font-semibold text-white">Demo experience</p><p className="mt-2 text-sm text-slate-400">Explore the workspace for {currentBusiness}, review the Business Brain, and test the assistant. Your changes reset when you close the demo.</p></article>
    </section>
  ) : activeTab === "overview" ? (
    <section className="grid gap-4 sm:grid-cols-3">
      {[
        ["Business details", builderValue.businessName.trim() && builderValue.industry.trim() ? "Ready" : "Add details"],
        ["Website knowledge", builderValue.websiteKnowledge ? "Imported" : "Not added"],
        ["Assistant readiness", builderValue.businessName.trim() ? "In progress" : "Start building"],
      ].map(([label, value]) => (
        <article key={label} className="rounded-2xl border border-white/[0.08] bg-[#050505] p-5 text-center"><p className="text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-sm text-slate-400">{label}</p></article>
      ))}
    </section>
  ) : (
    <AiBuilderWorkspaceView
      mode="preview"
      activeView={activeView}
      session={previewSession}
      builder={builderValue}
      diagnostics={diagnostics}
      knowledge={knowledge}
      projectId={previewSession.id}
      previewMode
      embeddedReview
      dashboardShowcase
      onBuilderChange={setBuilderValue}
      onBuild={buildVisitorBrain}
      onReviewCommand={async (command) => setPreviewSession((current) => updatePreviewSession(current, command))}
      onBack={() => setActiveTab("dashboard")}
      onLaunchChat={() => setActiveTab("chat")}
      showLaunchChat
    />
  );

  const rightRail = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.08] px-5 py-4 text-center"><p className="text-sm font-semibold text-white">{currentBusiness} Assistant</p><p className="mt-1 text-xs text-slate-500">Try it out. Your demo resets when you close it.</p></div>
      <div className="min-h-0 flex-1">
        <AiBuilderWorkspaceView
          mode="preview"
          activeView="chat"
          session={previewSession}
          builder={builderValue}
          knowledge={knowledge}
          projectId={previewSession.id}
          onBack={() => setActiveTab("dashboard")}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[220] bg-black">
      <button type="button" onClick={onClose} aria-label="Close demo" className="fixed right-4 top-4 z-[240] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] bg-[#090909] text-xl text-white transition hover:border-amber-300/40 hover:bg-[#111111]">×</button>
      <AiBuilderWorkspaceFrame
        title={`${title} · ${currentBusiness}`}
        onBuilderSelect={() => setActiveTab("builder")}
        builderActive={activeTab === "builder"}
        items={ITEMS.filter(([value]) => value !== "builder").map(([value, label]) => ({
          value,
          label,
          active: activeTab === value,
          onSelect: () => setActiveTab(value),
        }))}
        rightRail={rightRail}
      >
        {mainContent}
      </AiBuilderWorkspaceFrame>
    </div>
  );
}
