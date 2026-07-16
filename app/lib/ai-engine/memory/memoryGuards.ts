/**
 * Memory Guards
 *
 * Purpose:
 * Protects useful thread state from low-signal updates and sidetracks.
 */

import type { DemoThreadMemory } from "@/app/lib/ai-engine/contracts";
import type {
  ThreadMemoryGuardFailure,
  ThreadMemoryProposal,
} from "./contracts";
import {
  normalizeMemoryText,
  normalizeOptionalMemoryText,
} from "./memoryNormalizer";

export function isLowSignalMemoryText(value: unknown): boolean {
  const normalized = normalizeMemoryText(value).toLowerCase();

  if (!normalized) return true;
  if (normalized.length < 4) return true;

  return /^(ok|okay|cool|yes|yep|sure|thanks|thank you|got it|nice|lol|maybe|hmm|wait|hold on)[.!?]*$/.test(
    normalized,
  );
}

export function guardThreadProposal(params: {
  previous: DemoThreadMemory;
  proposal: ThreadMemoryProposal;
  preserveCoreState: boolean;
}): {
  proposal: ThreadMemoryProposal;
  failures: ThreadMemoryGuardFailure[];
} {
  const failures: ThreadMemoryGuardFailure[] = [];
  const corrected: ThreadMemoryProposal = {
    ...params.proposal,
    stickyState: {
      ...(params.proposal.stickyState ?? {}),
    },
  };

  if (params.preserveCoreState) {
    if (
      normalizeOptionalMemoryText(corrected.primaryGoal) !==
      params.previous.primaryGoal
    ) {
      corrected.primaryGoal = params.previous.primaryGoal;
      failures.push(
        "sidetrack_primary_goal_overwrite_blocked",
      );
    }

    if (
      normalizeOptionalMemoryText(corrected.currentSubject) !==
      params.previous.currentSubject
    ) {
      corrected.currentSubject = params.previous.currentSubject;
      failures.push(
        "sidetrack_subject_overwrite_blocked",
      );
    }

    if (
      normalizeOptionalMemoryText(corrected.selectedService) !==
      params.previous.selectedService
    ) {
      corrected.selectedService = params.previous.selectedService;
      failures.push(
        "sidetrack_service_overwrite_blocked",
      );
    }
  }

  if (
    corrected.summary !== undefined &&
    isLowSignalMemoryText(corrected.summary)
  ) {
    corrected.summary = params.previous.summary;
    failures.push("low_signal_summary_blocked");
  }

  if (
    corrected.primaryGoal !== undefined &&
    corrected.primaryGoal !== null &&
    isLowSignalMemoryText(corrected.primaryGoal)
  ) {
    corrected.primaryGoal = params.previous.primaryGoal;
    failures.push("low_signal_goal_blocked");
  }

  if (
    corrected.currentSubject !== undefined &&
    corrected.currentSubject !== null &&
    isLowSignalMemoryText(corrected.currentSubject)
  ) {
    corrected.currentSubject = params.previous.currentSubject;
    failures.push("low_signal_subject_blocked");
  }

  return {
    proposal: corrected,
    failures,
  };
}
