"use client";

type ThemeMode = "dark" | "light" | "system";

export type AiBuilderLocalPreferences = {
  theme: ThemeMode;
  compactNavigation: boolean;
  reducedMotion: boolean;
  sourceWarnings: boolean;
  reviewReminders: boolean;
};

export const AI_BUILDER_SETTINGS_KEY = "ai-builder-settings";

export const DEFAULT_AI_BUILDER_PREFERENCES: AiBuilderLocalPreferences = {
  theme: "dark",
  compactNavigation: false,
  reducedMotion: false,
  sourceWarnings: true,
  reviewReminders: true,
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeAiBuilderPreferences(value: unknown): AiBuilderLocalPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_AI_BUILDER_PREFERENCES;
  }

  const parsed = value as Record<string, unknown>;
  return {
    theme: isThemeMode(parsed.theme) ? parsed.theme : DEFAULT_AI_BUILDER_PREFERENCES.theme,
    compactNavigation: parseBoolean(
      parsed.compactNavigation,
      DEFAULT_AI_BUILDER_PREFERENCES.compactNavigation,
    ),
    reducedMotion: parseBoolean(
      parsed.reducedMotion,
      DEFAULT_AI_BUILDER_PREFERENCES.reducedMotion,
    ),
    sourceWarnings: parseBoolean(
      parsed.sourceWarnings,
      DEFAULT_AI_BUILDER_PREFERENCES.sourceWarnings,
    ),
    reviewReminders: parseBoolean(
      parsed.reviewReminders,
      DEFAULT_AI_BUILDER_PREFERENCES.reviewReminders,
    ),
  };
}

export function applyAiBuilderPreferences(preferences: AiBuilderLocalPreferences) {
  const resolvedTheme =
    preferences.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : preferences.theme;

  document.documentElement.dataset.aiBuilderTheme = resolvedTheme;
  document.documentElement.dataset.aiBuilderCompact = String(preferences.compactNavigation);
  document.documentElement.dataset.aiBuilderReducedMotion = String(preferences.reducedMotion);
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function loadAiBuilderPreferences(): AiBuilderLocalPreferences {
  const saved = window.localStorage.getItem(AI_BUILDER_SETTINGS_KEY);
  if (!saved) return DEFAULT_AI_BUILDER_PREFERENCES;

  try {
    return sanitizeAiBuilderPreferences(JSON.parse(saved));
  } catch {
    return DEFAULT_AI_BUILDER_PREFERENCES;
  }
}

export default function AiBuilderSettings() {
  return null;
}
