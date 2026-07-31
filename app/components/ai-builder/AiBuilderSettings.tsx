"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

type ThemeMode = "dark" | "light" | "system";

type LocalPreferences = {
  theme: ThemeMode;
  compactNavigation: boolean;
  reducedMotion: boolean;
  sourceWarnings: boolean;
  reviewReminders: boolean;
};

const DEFAULT_PREFERENCES: LocalPreferences = {
  theme: "dark",
  compactNavigation: false,
  reducedMotion: false,
  sourceWarnings: true,
  reviewReminders: true,
};

const sectionClassName =
  "rounded-[22px] border border-white/[0.08] bg-[#050505] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)]";

function applyPreferences(preferences: LocalPreferences) {
  const resolvedTheme = preferences.theme === "system"
    ? window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"
    : preferences.theme;

  document.documentElement.dataset.aiBuilderTheme = resolvedTheme;
  document.documentElement.dataset.aiBuilderCompact = String(preferences.compactNavigation);
  document.documentElement.dataset.aiBuilderReducedMotion = String(preferences.reducedMotion);
  document.documentElement.style.colorScheme = resolvedTheme;
}

export default function AiBuilderSettings() {
  const { project, renameProject, session, websiteKnowledge } = useAiBuilderWorkspace();
  const [preferences, setPreferences] = useState<LocalPreferences>(DEFAULT_PREFERENCES);
  const [provider, setProvider] = useState("OpenAI");
  const [apiKey, setApiKey] = useState("");
  const [projectName, setProjectName] = useState(project.businessName);
  const [projectSaveState, setProjectSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [projectSaveMessage, setProjectSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setProjectName(project.businessName);
  }, [project.businessName]);

  useEffect(() => {
    const saved = window.localStorage.getItem("ai-builder-settings");
    if (!saved) {
      applyPreferences(DEFAULT_PREFERENCES);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<LocalPreferences>;
      const next = { ...DEFAULT_PREFERENCES, ...parsed };
      setPreferences(next);
      applyPreferences(next);
    } catch {
      applyPreferences(DEFAULT_PREFERENCES);
    }
  }, []);

  useEffect(() => {
    if (preferences.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const sync = () => applyPreferences(preferences);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preferences]);

  const updatePreferences = (next: LocalPreferences) => {
    setPreferences(next);
    window.localStorage.setItem("ai-builder-settings", JSON.stringify(next));
    applyPreferences(next);
  };

  const setTheme = (theme: ThemeMode) => {
    updatePreferences({ ...preferences, theme });
  };

  const togglePreference = (
    key: Exclude<keyof LocalPreferences, "theme">,
  ) => {
    updatePreferences({ ...preferences, [key]: !preferences[key] });
  };

  const saveProjectName = async () => {
    const nextName = projectName.trim();
    if (!nextName) {
      setProjectSaveState("error");
      setProjectSaveMessage("A project name is required.");
      return;
    }

    if (nextName === project.businessName) {
      setProjectSaveState("idle");
      setProjectSaveMessage(null);
      return;
    }

    setProjectSaveState("saving");
    setProjectSaveMessage(null);
    try {
      await renameProject(nextName);
      setProjectSaveState("saved");
      setProjectSaveMessage("Project name updated.");
    } catch (error) {
      setProjectSaveState("error");
      setProjectSaveMessage(error instanceof Error ? error.message : "The project could not be renamed.");
    }
  };

  return (
    <div className="space-y-6">
      <section className={sectionClassName}>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Project settings</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Project identity</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Rename this project and review the business details currently attached to it.
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Project name</span>
            <input
              value={projectName}
              onChange={(event) => {
                setProjectName(event.target.value);
                if (projectSaveState !== "idle") {
                  setProjectSaveState("idle");
                  setProjectSaveMessage(null);
                }
              }}
              maxLength={160}
              className="min-h-11 w-full rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white outline-none focus:border-amber-300/35"
            />
          </label>

          <ReadOnlyField label="Industry" value={project.industry || "Not set"} />

          <button
            type="button"
            onClick={saveProjectName}
            disabled={projectSaveState === "saving" || !projectName.trim() || projectName.trim() === project.businessName}
            className="mt-auto min-h-11 rounded-lg border border-amber-300/20 bg-black px-5 text-sm font-bold text-white transition hover:border-amber-300/40 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:text-slate-600"
          >
            {projectSaveState === "saving" ? "Saving..." : "Save name"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReadOnlySettingRow label="Website" value={project.website || "Not set"} />
          <ReadOnlySettingRow label="Assistant tone" value={project.tone || "Professional"} />
        </div>

        {projectSaveMessage ? (
          <p
            className={`mt-4 text-sm ${projectSaveState === "error" ? "text-red-300" : "text-emerald-300"}`}
            role={projectSaveState === "error" ? "alert" : "status"}
          >
            {projectSaveMessage}
          </p>
        ) : null}
      </section>

      <section className={sectionClassName}>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Account</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Profile and username</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Manage the account identity used across this AI Builder workspace.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/30">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-none",
                card: "w-full bg-transparent shadow-none",
                navbar: "border-r border-white/[0.08] bg-[#050505]",
                navbarButton: "text-slate-300",
                navbarButtonActive: "text-amber-300",
                headerTitle: "text-white",
                headerSubtitle: "text-slate-400",
                profileSectionTitleText: "text-white",
                profileSectionContent: "text-slate-300",
                formFieldLabel: "text-slate-300",
                formFieldInput: "border-white/[0.1] bg-black text-white",
                formButtonPrimary: "bg-amber-300 text-black hover:bg-amber-200",
              },
            }}
          />
        </div>
      </section>

      <section className={sectionClassName}>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Plan and billing</p>
        <div className="mt-3 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Manage your plan</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Review plan options now. Direct billing and subscription management will be wired once Stripe access is available.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign("/pricing")}
            className="cta-raised inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-300/20 bg-black px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-[#0a0a0a]"
          >
            View plans
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingRow label="Project status" value={session.status} />
          <SettingRow label="Approved knowledge" value={String(session.contextCounts.approved)} />
          <SettingRow label="Imported pages" value={String(websiteKnowledge?.pages.length ?? 0)} />
          <SettingRow label="Governance revision" value={String(session.governanceRevision ?? 0)} />
        </div>
      </section>

      <section className={sectionClassName}>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Appearance</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Workspace theme</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose how the AI Builder workspace appears on this device.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ThemeOption label="Dark" active={preferences.theme === "dark"} onClick={() => setTheme("dark")} />
          <ThemeOption label="Light" active={preferences.theme === "light"} onClick={() => setTheme("light")} />
          <ThemeOption label="System" active={preferences.theme === "system"} onClick={() => setTheme("system")} />
        </div>

        <div className="mt-5 space-y-3">
          <ToggleRow
            label="Compact navigation"
            description="Use tighter spacing in the project sidebar."
            checked={preferences.compactNavigation}
            onChange={() => togglePreference("compactNavigation")}
          />
          <ToggleRow
            label="Reduce motion"
            description="Limit non-essential workspace transitions on this device."
            checked={preferences.reducedMotion}
            onChange={() => togglePreference("reducedMotion")}
          />
        </div>
      </section>

      <section className={sectionClassName}>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Notifications</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Workspace alerts</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Save local alert preferences now. Delivery channels can be connected later.
        </p>
        <div className="mt-5 space-y-3">
          <ToggleRow
            label="Source import warnings"
            description="Keep warnings visible when imported material needs attention."
            checked={preferences.sourceWarnings}
            onChange={() => togglePreference("sourceWarnings")}
          />
          <ToggleRow
            label="Business Knowledge review reminders"
            description="Keep pending review work highlighted across the workspace."
            checked={preferences.reviewReminders}
            onChange={() => togglePreference("reviewReminders")}
          />
        </div>
      </section>

      <section className={sectionClassName}>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Bring your own key</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Provider credentials</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          The UI is ready, but keys will not be saved until encrypted server-side storage and validation are implemented.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Provider</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white outline-none focus:border-amber-300/35"
            >
              <option>OpenAI</option>
              <option>Anthropic</option>
              <option>Google</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Key storage is not enabled yet"
              autoComplete="off"
              className="min-h-11 w-full rounded-lg border border-white/[0.1] bg-black px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/35"
            />
          </label>
          <button
            type="button"
            disabled
            className="mt-auto min-h-11 rounded-lg border border-white/[0.06] bg-black/30 px-5 text-sm font-bold text-slate-600"
          >
            Save key
          </button>
        </div>
      </section>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input
        value={value}
        readOnly
        className="min-h-11 w-full rounded-lg border border-white/[0.07] bg-black/30 px-3 text-sm text-slate-400 outline-none"
      />
    </label>
  );
}

function ReadOnlySettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white" title={value}>{value}</p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold capitalize text-white">{value}</span>
    </div>
  );
}

function ThemeOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-4 text-left transition ${
        active
          ? "border-amber-300/30 bg-amber-300/[0.06] text-white"
          : "border-white/[0.07] bg-black/30 text-slate-400 hover:border-white/[0.12] hover:text-white"
      }`}
      aria-pressed={active}
    >
      <span className="text-sm font-semibold">{label} mode</span>
      <span className="mt-1 block text-xs text-slate-500">
        {active ? "Currently selected" : "Use this appearance"}
      </span>
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-center justify-between gap-5 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-4 text-left transition hover:border-white/[0.11]"
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <span
        className={`relative h-6 w-11 flex-none rounded-full border transition ${
          checked
            ? "border-amber-300/30 bg-amber-300/20"
            : "border-white/[0.1] bg-white/[0.04]"
        }`}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition ${
            checked ? "left-6 bg-amber-300" : "left-1 bg-slate-500"
          }`}
        />
      </span>
    </button>
  );
}
