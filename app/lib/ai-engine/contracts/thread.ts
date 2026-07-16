/**
 * Thread Contracts
 *
 * Defines conversation turns and compressed thread state.
 */

export const THREAD_MEMORY_STATUSES = [
    "active",
    "paused",
    "completed",
  ] as const;
  
  export type ThreadMemoryStatus =
    (typeof THREAD_MEMORY_STATUSES)[number];
  
  export const THREAD_DECISIONS = [
    "continue",
    "sidetrack",
    "resume",
    "topic_change",
    "reset",
  ] as const;
  
  export type ThreadDecision = (typeof THREAD_DECISIONS)[number];
  
  export type DemoTurnRole = "user" | "assistant" | "system";
  
  export type DemoTurn = {
    id: string;
    threadId: string;
    sessionId: string;
    role: DemoTurnRole;
    message: string;
    intent: string | null;
    usedContextIds: string[];
    createdAt: string;
  };
  
  export type DemoThreadMemory = {
    threadId: string;
    sessionId: string;
    status: ThreadMemoryStatus;
    primaryGoal: string | null;
    currentSubject: string | null;
    selectedService: string | null;
    activeConstraints: string[];
    collectedDetails: string[];
    unresolvedQuestions: string[];
    recentClarifications: string[];
    summary: string;
    stickyState: Record<string, unknown>;
    lastUpdatedAt: string;
  };
  
  export type ThreadMemoryUpdate = {
    decision: ThreadDecision;
    previous: DemoThreadMemory;
    proposed: DemoThreadMemory;
    corrected: DemoThreadMemory;
    corrections: string[];
  };
  