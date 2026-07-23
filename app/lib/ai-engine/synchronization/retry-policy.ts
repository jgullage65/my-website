import type { SynchronizationFailureClass } from "./failure-classification";

export const MAX_SYNCHRONIZATION_ATTEMPTS = 5;
const delays = [60, 5 * 60, 15 * 60, 60 * 60, 6 * 60 * 60] as const;
export function retryDelaySeconds(attemptCount: number): number { return delays[Math.min(Math.max(attemptCount, 1), delays.length) - 1]!; }
export function shouldRetryFailure(kind: SynchronizationFailureClass, attemptCount: number, workStarted = true): boolean {
  if (kind === "permanent") return false;
  if (kind === "concurrency") return !workStarted;
  return attemptCount < MAX_SYNCHRONIZATION_ATTEMPTS;
}
