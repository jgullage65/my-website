export function formatModelDisplayName(value: unknown) {
  if (typeof value !== "string") return null;

  const model = value.trim();
  if (!model) return null;

  const normalized = model.toLowerCase();

  if (normalized.startsWith("gpt-5-mini")) return "GPT-5 Mini";
  if (normalized.startsWith("gpt-5")) return "GPT-5";
  if (normalized.startsWith("gpt-4.1-mini")) return "GPT-4.1 Mini";
  if (normalized.startsWith("gpt-4.1")) return "GPT-4.1";
  if (normalized.startsWith("gpt-4o-mini")) return "GPT-4o Mini";
  if (normalized.startsWith("gpt-4o")) return "GPT-4o";

  if (normalized.includes("claude") && normalized.includes("sonnet")) {
    return "Claude Sonnet";
  }
  if (normalized.includes("claude") && normalized.includes("opus")) {
    return "Claude Opus";
  }
  if (normalized.includes("claude") && normalized.includes("haiku")) {
    return "Claude Haiku";
  }

  if (normalized.startsWith("grok")) return "Grok";
  if (normalized.startsWith("gemini-2.5-pro")) return "Gemini 2.5 Pro";
  if (normalized.startsWith("gemini-2.5-flash")) return "Gemini 2.5 Flash";

  return model;
}
