export function reviewProjectStatus(
  approvedBusinessKnowledgeCount: number,
): "ready" | "review_required" {
  return approvedBusinessKnowledgeCount > 0 ? "ready" : "review_required";
}
