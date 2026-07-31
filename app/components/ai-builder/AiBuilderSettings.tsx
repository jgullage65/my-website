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

export default function AiBuilderSettings() {
  return null;
}
