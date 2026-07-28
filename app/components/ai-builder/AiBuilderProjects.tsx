"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderLanding from "./AiBuilderLanding";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

type Project = {
  id: string;
  businessName: string;
  website: string | null;
  industry: string;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  stateRevision: number;
};

type ProjectView = "active" | "archived";

const PROJECT_LIMIT = 3;

function date(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function domain(value: string | null) {
  if (!value) return "No website added";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export default function AiBuilderProjects() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<ProjectView>("active");
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const openProjects = useMemo(() => projects.filter((project) => !project.archivedAt), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.archivedAt), [projects]);
  const visibleProjects = view === "active" ? openProjects : archivedProjects;

  async function refreshAuthoritativeProjects() {
    const response = await fetch("/api/ai-builder/projects", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) setProjects(payload.projects);
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setProjects([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error("Your projects could not be loaded. Please sign in again.");
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Projects could not be loaded.");
        if (!cancelled) setProjects(payload.projects);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Projects could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  async function beginProjectCreation() {
    if (projects.length < PROJECT_LIMIT) {
      router.push("/ai-builder?new=1");
      return;
    }
    const contact = await showConfirm({
      title: "Project Limit Reached",
      message: "You've reached your current project limit of 3 projects.\n\nContact James to discuss purchasing a current project or increasing your project limit.",
      cancelLabel: "Cancel",
      confirmLabel: "Contact James",
    });
    if (contact) router.push("/contact");
  }

  async function rename(project: Project) {
    const businessName = window.prompt("Rename project", project.businessName)?.trim();
    if (!businessName || businessName === project.businessName) return;
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, expectedRevision: project.stateRevision }),
      });
      const payload = await response.json();
      if (response.status === 409) await refreshAuthoritativeProjects();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, businessName, stateRevision: payload.stateRevision, updatedAt: new Date().toISOString() } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be renamed.");
    } finally {
      setBusy(null);
      setMenu(null);
    }
  }

  async function archive(project: Project) {
    const confirmed = await showConfirm({
      title: `Archive ${project.businessName}?`,
      message: "This removes the project from your active projects without deleting its saved knowledge or chat history.",
      confirmLabel: "Archive",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}?expectedRevision=${project.stateRevision}`, { method: "DELETE" });
      const payload = await response.json();
      if (response.status === 409) await refreshAuthoritativeProjects();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      const now = new Date().toISOString();
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, archivedAt: now, stateRevision: payload.stateRevision, updatedAt: now } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be archived.");
    } finally {
      setBusy(null);
      setMenu(null);
    }
  }

  async function restore(project: Project) {
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true, expectedRevision: project.stateRevision }),
      });
      const payload = await response.json();
      if (response.status === 409) await refreshAuthoritativeProjects();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      const now = new Date().toISOString();
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, archivedAt: null, stateRevision: payload.stateRevision, updatedAt: now } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The project could not be restored.");
    } finally {
      setBusy(null);
      setMenu(null);
    }
  }

  if (isLoaded && !isSignedIn) return <AiBuilderShell><AiBuilderLanding /></AiBuilderShell>;

  return (
    <AiBuilderShell>
      {confirmDialogNode}
      <div className="relative w-full bg-black px-4 py-7 sm:px-6 sm:py-9 min-[1200px]:mx-auto min-[1200px]:rounded-[30px] min-[1200px]:border min-[1200px]:border-white/[0.09] min-[1200px]:px-10 min-[1200px]:shadow-[0_18px_60px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">AI Builder</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-.035em] text-white sm:text-3xl">Your AI projects</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Open a business workspace, continue training its assistant, or start a new project.</p>
          </div>
          {isSignedIn ? <SignOutButton redirectUrl="/ai-builder"><button type="button" className="shrink-0 rounded-lg border border-white/10 bg-black px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-amber-300/25 hover:text-white">Sign out</button></SignOutButton> : null}
        </div>

        {error ? <div className="mt-6 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {loading ? <div className="mt-8 rounded-2xl border border-white/[.08] bg-[#050505] p-12 text-center text-slate-400">Loading your projects…</div> : null}

        {isSignedIn && !loading && !projects.length ? (
          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-[#050505] px-6 py-16 text-center shadow-[0_24px_90px_rgba(0,0,0,.34)]">
            <h2 className="text-2xl font-black tracking-[-.035em] text-white">Build your first business AI</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-400">Create a project and your work will be saved here whenever you return.</p>
            <button type="button" onClick={() => void beginProjectCreation()} className="mt-7 inline-flex items-center justify-center rounded-lg border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_14px_36px_rgba(212,175,55,.16),inset_0_1px_0_rgba(255,255,255,.16)] transition hover:-translate-y-0.5 hover:border-amber-300/35">Create Your First Project</button>
          </div>
        ) : null}

        {isSignedIn && !loading && projects.length ? (
          <div className="mt-8">
            <div className="flex flex-col gap-4 border-b border-white/[.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2 rounded-xl border border-white/[.08] bg-[#050505] p-1.5">
                <ViewButton active={view === "active"} label="Active" count={openProjects.length} onClick={() => { setView("active"); setMenu(null); }} />
                <ViewButton active={view === "archived"} label="Archived" count={archivedProjects.length} onClick={() => { setView("archived"); setMenu(null); }} />
              </div>
              <button type="button" onClick={() => void beginProjectCreation()} className="inline-flex items-center justify-center rounded-lg border border-amber-300/20 bg-[#080808] px-5 py-3 text-sm font-black text-white shadow-[0_14px_36px_rgba(212,175,55,.16),inset_0_1px_0_rgba(255,255,255,.16)] transition hover:-translate-y-0.5 hover:border-amber-300/35">New AI Builder Project</button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-[-.025em] text-white">{view === "active" ? "Active projects" : "Archived projects"}</h2>
                <p className="mt-1 text-sm text-slate-500">{view === "active" ? "Select a workspace to continue building." : "Restore a project when you are ready to use it again."}</p>
              </div>
              <span className="rounded-full border border-amber-300/15 bg-black px-3 py-1.5 text-xs font-bold text-[var(--gold)]">{visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}</span>
            </div>

            <ProjectGrid projects={visibleProjects} archived={view === "archived"} menu={menu} busy={busy} setMenu={setMenu} onRename={rename} onArchive={archive} onRestore={restore} />
          </div>
        ) : null}
      </div>
    </AiBuilderShell>
  );
}

function ViewButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${active ? "bg-white/[.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]" : "text-slate-500 hover:text-slate-200"}`}>{label}<span className={active ? "text-[var(--gold)]" : "text-slate-600"}>{count}</span></button>;
}

function ProjectGrid({ projects, archived, menu, busy, setMenu, onRename, onArchive, onRestore }: { projects: Project[]; archived: boolean; menu: string | null; busy: string | null; setMenu: (id: string | null) => void; onRename: (project: Project) => void; onArchive: (project: Project) => void; onRestore: (project: Project) => void }) {
  if (!projects.length) return <div className="mt-5 rounded-2xl border border-white/[.08] bg-[#050505] px-6 py-12 text-center"><p className="text-sm text-slate-400">No {archived ? "archived" : "active"} projects.</p></div>;

  return <div className="mt-5 grid gap-4 xl:grid-cols-2">{projects.map((project) => (
    <article key={project.id} className="group relative overflow-visible rounded-2xl border border-white/[.09] bg-[linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))] p-5 shadow-[0_18px_42px_rgba(0,0,0,.22)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/25">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.16em] ${archived ? "border-white/10 text-slate-500" : "border-emerald-300/15 bg-emerald-300/[.04] text-emerald-300"}`}>{archived ? "Archived" : "Active"}</span>
            {project.industry ? <span className="truncate text-xs text-slate-500">{project.industry}</span> : null}
          </div>
          <h3 className="mt-3 truncate text-xl font-black tracking-[-.03em] text-white">{project.businessName}</h3>
          <p className="mt-1 truncate text-sm text-slate-400">{domain(project.website)}</p>
        </div>

        <div className="relative shrink-0">
          <button type="button" aria-label={`Actions for ${project.businessName}`} aria-haspopup="menu" aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black text-lg text-slate-300 transition hover:border-amber-300/30 hover:text-white">•••</button>
          {menu === project.id ? <div role="menu" className="absolute right-0 top-11 z-20 min-w-[160px] rounded-xl border border-[rgba(212,175,55,.2)] bg-[#050505] p-1.5 shadow-2xl">
            {!archived ? <><Link role="menuitem" href={`/ai-builder?projectId=${encodeURIComponent(project.id)}`} className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.04] hover:text-[var(--gold)]">Open</Link><button role="menuitem" disabled={busy === project.id} onClick={() => onRename(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.04] hover:text-[var(--gold)]">Rename</button><button role="menuitem" disabled={busy === project.id} onClick={() => onArchive(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10">Archive</button></> : <button role="menuitem" disabled={busy === project.id} onClick={() => onRestore(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-white/[0.04]">Restore</button>}
          </div> : null}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-white/[.07] bg-black/45">
        <Stat label="Updated" value={date(project.updatedAt)} compact />
        <Stat label="Created" value={date(project.createdAt)} compact />
        <Stat label="Messages" value={String(project.messageCount)} />
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="truncate text-xs text-slate-600">Project ID: {project.id}</p>
        {!archived ? <Link href={`/ai-builder?projectId=${encodeURIComponent(project.id)}`} className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2.5 text-xs font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:border-amber-300/30 hover:text-[var(--gold)]">Open project</Link> : <button type="button" disabled={busy === project.id} onClick={() => onRestore(project)} className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2.5 text-xs font-black text-white transition hover:border-amber-300/30 hover:text-[var(--gold)] disabled:opacity-50">Restore project</button>}
      </div>
    </article>
  ))}</div>;
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className="min-w-0 border-r border-white/[.07] px-3 py-3 text-center last:border-r-0"><dt className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--gold)]">{label}</dt><dd className={`mt-1 font-bold text-white ${compact ? "truncate text-[11px]" : "text-sm"}`} title={value}>{value}</dd></div>;
}
