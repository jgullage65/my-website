export type SynchronizationFailureClass = "transient" | "precondition" | "concurrency" | "permanent" | "unknown";

/** Error codes are part of the operational contract; never infer them from prose. */
export function classifySynchronizationFailure(errorCode: string): SynchronizationFailureClass {
  if (["downstream_synchronization_project_not_found", "downstream_synchronization_project_not_found_or_archived", "downstream_synchronization_invalid_state"].includes(errorCode)) return "permanent";
  if (["downstream_synchronization_trusted_knowledge_revision_not_ready"].includes(errorCode)) return "precondition";
  if (["downstream_synchronization_job_already_running", "downstream_synchronization_stale_recovery_revision"].includes(errorCode)) return "concurrency";
  if (errorCode.endsWith("_timeout") || errorCode.endsWith("_connection_failed") || errorCode.endsWith("_transaction_retry")) return "transient";
  if (["business_memory_synchronization_verification_failed", "assistant_projection_synchronization_verification_failed"].includes(errorCode)) return "unknown";
  return "unknown";
}
