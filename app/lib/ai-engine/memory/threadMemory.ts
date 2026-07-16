/**
 * Thread Memory
 *
 * Purpose:
 * Builds and updates protected conversation memory.
 *
 * Rules:
 * - sidetracks preserve the core goal, subject, and selected service
 * - resume restores paused thread state when available
 * - reset clears conversation-specific memory
 * - low-signal values never replace useful existing memory
 */

import type {
    DemoThreadMemory,
    ThreadDecision,
  } from "@/app/lib/ai-engine/contracts";
  import type {
    ThreadMemoryProposal,
    ThreadMemoryUpdateInput,
    ThreadMemoryUpdateResult,
  } from "./contracts";
  import { guardThreadProposal } from "./memoryGuards";
  import {
    normalizeIsoDate,
    normalizeMemoryArray,
    normalizeMemoryText,
    normalizeOptionalMemoryText,
    normalizeStickyState,
    normalizeThreadMemory,
  } from "./memoryNormalizer";
  
  export function buildInitialThreadMemory(params: {
    threadId: string;
    sessionId: string;
    updatedAt?: string;
  }): DemoThreadMemory {
    return {
      threadId: params.threadId,
      sessionId: params.sessionId,
      status: "active",
      primaryGoal: null,
      currentSubject: null,
      selectedService: null,
      activeConstraints: [],
      collectedDetails: [],
      unresolvedQuestions: [],
      recentClarifications: [],
      summary: "Thread started.",
      stickyState: {},
      lastUpdatedAt: normalizeIsoDate(params.updatedAt),
    };
  }
  
  function mergeProposal(
    previous: DemoThreadMemory,
    proposal: ThreadMemoryProposal,
    updatedAt?: string,
  ): DemoThreadMemory {
    return normalizeThreadMemory({
      ...previous,
      primaryGoal:
        proposal.primaryGoal === undefined
          ? previous.primaryGoal
          : normalizeOptionalMemoryText(proposal.primaryGoal),
      currentSubject:
        proposal.currentSubject === undefined
          ? previous.currentSubject
          : normalizeOptionalMemoryText(proposal.currentSubject),
      selectedService:
        proposal.selectedService === undefined
          ? previous.selectedService
          : normalizeOptionalMemoryText(proposal.selectedService),
      activeConstraints:
        proposal.activeConstraints === undefined
          ? previous.activeConstraints
          : normalizeMemoryArray(proposal.activeConstraints, 12),
      collectedDetails:
        proposal.collectedDetails === undefined
          ? previous.collectedDetails
          : normalizeMemoryArray(proposal.collectedDetails, 20),
      unresolvedQuestions:
        proposal.unresolvedQuestions === undefined
          ? previous.unresolvedQuestions
          : normalizeMemoryArray(proposal.unresolvedQuestions, 12),
      recentClarifications:
        proposal.recentClarifications === undefined
          ? previous.recentClarifications
          : normalizeMemoryArray(
              proposal.recentClarifications,
              12,
            ),
      summary:
        proposal.summary === undefined
          ? previous.summary
          : normalizeMemoryText(proposal.summary),
      stickyState: {
        ...normalizeStickyState(previous.stickyState),
        ...normalizeStickyState(proposal.stickyState),
      },
      lastUpdatedAt: normalizeIsoDate(updatedAt),
    });
  }
  
  function getPausedSnapshot(
    memory: DemoThreadMemory,
  ): Record<string, unknown> {
    const stickyState = normalizeStickyState(memory.stickyState);
    const snapshot = stickyState.pausedThread;
  
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      Array.isArray(snapshot)
    ) {
      return {};
    }
  
    return snapshot as Record<string, unknown>;
  }
  
  function applyDecision(
    previous: DemoThreadMemory,
    proposed: DemoThreadMemory,
    decision: ThreadDecision,
  ): DemoThreadMemory {
    if (decision === "sidetrack") {
      return normalizeThreadMemory({
        ...proposed,
        status: "paused",
        primaryGoal: previous.primaryGoal,
        currentSubject: previous.currentSubject,
        selectedService: previous.selectedService,
        activeConstraints: previous.activeConstraints.slice(),
        stickyState: {
          ...proposed.stickyState,
          sidetrackActive: true,
          pausedThread: {
            primaryGoal: previous.primaryGoal,
            currentSubject: previous.currentSubject,
            selectedService: previous.selectedService,
            activeConstraints: previous.activeConstraints.slice(),
            summary: previous.summary,
          },
        },
      });
    }
  
    if (decision === "resume") {
      const snapshot = getPausedSnapshot(previous);
  
      return normalizeThreadMemory({
        ...proposed,
        status: "active",
        primaryGoal:
          normalizeOptionalMemoryText(snapshot.primaryGoal) ??
          previous.primaryGoal ??
          proposed.primaryGoal,
        currentSubject:
          normalizeOptionalMemoryText(snapshot.currentSubject) ??
          previous.currentSubject ??
          proposed.currentSubject,
        selectedService:
          normalizeOptionalMemoryText(snapshot.selectedService) ??
          previous.selectedService ??
          proposed.selectedService,
        activeConstraints:
          Array.isArray(snapshot.activeConstraints)
            ? normalizeMemoryArray(snapshot.activeConstraints, 12)
            : previous.activeConstraints.slice(),
        stickyState: {
          ...proposed.stickyState,
          sidetrackActive: false,
        },
      });
    }
  
    if (decision === "reset") {
      return buildInitialThreadMemory({
        threadId: previous.threadId,
        sessionId: previous.sessionId,
        updatedAt: proposed.lastUpdatedAt,
      });
    }
  
    if (decision === "topic_change") {
      return normalizeThreadMemory({
        ...proposed,
        status: "active",
        activeConstraints: [],
        unresolvedQuestions: [],
        recentClarifications: [],
        stickyState: {
          ...proposed.stickyState,
          sidetrackActive: false,
          pausedThread: null,
        },
      });
    }
  
    return normalizeThreadMemory({
      ...proposed,
      status: "active",
    });
  }
  
  export function updateThreadMemory(
    input: ThreadMemoryUpdateInput,
  ): ThreadMemoryUpdateResult {
    const previous = normalizeThreadMemory(input.previous);
    const proposal = input.proposal ?? {};
  
    const guard = guardThreadProposal({
      previous,
      proposal,
      preserveCoreState: input.decision === "sidetrack",
    });
  
    const proposed = mergeProposal(
      previous,
      guard.proposal,
      input.updatedAt,
    );
  
    const memory = applyDecision(
      previous,
      proposed,
      input.decision,
    );
  
    const changed =
      JSON.stringify(previous) !== JSON.stringify(memory);
  
    return {
      memory,
      failures: guard.failures,
      changed,
    };
  }
  