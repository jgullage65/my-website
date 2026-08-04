const LEGACY_PROJECT_PREFIX = "ai_builder_session_";

export function toPublicBuildId(projectId: string): string {
  return projectId.startsWith(LEGACY_PROJECT_PREFIX)
    ? projectId.slice(LEGACY_PROJECT_PREFIX.length)
    : projectId;
}

export function toInternalProjectId(buildId: string): string {
  return buildId.startsWith(LEGACY_PROJECT_PREFIX)
    ? buildId
    : `${LEGACY_PROJECT_PREFIX}${buildId}`;
}
