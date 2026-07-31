"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
  model?: string | null;
};

type ProjectView = "active" | "archived";

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function domain(value: string | null) {
  if (!value) return "No website added";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an unexpected response.");
  }
  return response.json();
}

export default function AiBuilderProjects({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void } = {}) {
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

  async function hydrateModels(items: Project[]) {
    return Promise.all(items.map(async (project) => {
      try {
        const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, { cache: "no-store" });
        const payload = await readJson(response);
        if (!response.ok || !payload.ok) return { ...project, model: null };
        const generations = Array.isArray(payload?.diagnostics?.generations) ? payload.diagnostics.generations : [];
        const latestGeneration = [...generations].sort((left, right) => {
          const leftTime = new Date(String(left?.completed_at ?? left?.started_at ?? "")).getTime();
          const rightTime = new Date(String(right?.completed_at ?? right?.started_at ?? "")).getTime();
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        })[0];
        return { ...project, model: latestGeneration?.model ? String(latestGeneration.model) : null };
      } catch {
        return { ...project, model: null };
      }
    }));
  }

  async function refreshAuthoritativeProjects() {
    const response = await fetch("/api/ai-builder/projects", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok || !payload.ok || !Array.isArray(payload.projects)) {
      throw new Error(payload?.error?.message ?? "Projects could not be refreshed.");
    }
    setProjects(await hydrateModels(payload.projects as Project[]));
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
        const payload = await readJson(response);
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Projects could not be loaded.");
        const listedProjects = Array.isArray(payload.projects) ? payload.projects as Project[] : [];
        if (!listedProjects.length) {
          if (!cancelled) router.replace("/ai-builder?new=1");
          return;
        }
        const hydrated = await hydrateModels(listedProjects);
        if (!cancelled) setProjects(hydrated);
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
  }, [isLoaded, isSignedIn, router]);

  async function rename(project: Project) {
    const businessName = window.prompt("Rename project", project.businessName)?.trim();
    if (!businessName || businessName === project.businessName) return;
    setBusy(project.id);
    setError(null);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, expectedRevision: project.stateRevision }),
      });
      const payload = await readJson(response);
      if (response.status === 409) await refreshAuthoritativeProjects();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "The project could not be renamed.");
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, businessName: payload.businessName ?? businessName, stateRevision: payload.stateRevision, updatedAt: new Date().toISOString() } : item));
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
    setError(null);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}?expectedRevision=${project.stateRevision}`, { method: "DELETE" });
      const payload = await readJson(response);
      if (response.status === 409) await refreshAuthoritativeProjects();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "The project could not be archived.");
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
    setError(null);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true, expectedRevision: project.stateRevision }),
      });
      const payload = await readJson(response);
      if (response.status === 409) await refreshAuthoritativeProjects();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "The project could not be restored.");
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
    <ProjectsFrame embedded={embedded}>
      {confirmDialogNode}
      <div role="presentation" className="contents min-[1200px]:fixed min-[1200px]:inset-0 min-[1200px]:z-[100] min-[1200px]:flex min-[1200px]:items-center min-[1200px]:justify-center min-[1200px]:bg-black/75 min-[1200px]:p-8 min-[1200px]:backdrop-blur-md">
        <section role="dialog" aria-modal="true" aria-label="AI Builder projects" className="relative w-full bg-black px-4 py-7 sm:px-6 sm:py-9 min-[1200px]:flex min-[1200px]:max-h-[90dvh] min-[1200px]:max-w-[1100px] min-[1200px]:flex-col min-[1200px]:overflow-y-auto min-[1200px]:rounded-[24px] min-[1200px]:border min-[1200px]:border-white/[0.1] min-[1200px]:bg-[#030303] min-[1200px]:px-10 min-[1200px]:py-6 min-[1200px]:shadow-[0_32px_110px_rgba(0,0,0,0.72)]">
          {onClose ? <button type="button" onClick={onClose} className="absolute right-6 top-4 z-10 hidden rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white min-[1200px]:inline-flex">Done</button> : null}

          {error ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          {loading ? <div className="rounded-2xl border border-white/[.08] bg-[#050505] p-12 text-center text-slate-400">Loading your projects…</div> : null}

          {isSignedIn && !loading && projects.length ? (
            <div>
              <div className="flex justify-center border-b border-white/[.08] pb-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/[.08] bg-[#050505] p-1.5">
                  <ViewButton active={view === "active"} label="Active" count={openProjects.length} onClick={() => { setView("active"); setMenu(null); }} />
                  <ViewButton active={view === "archived"} label="Archived" count={archivedProjects.length} onClick={() => { setView("archived"); setMenu(null); }} />
                </div>
              </div>

              <ProjectGrid projects={visibleProjects} archived={view === "archived"} menu={menu} busy={busy} setMenu={setMenu} onRename={rename} onArchive={archive} onRestore={restore} />
            </div>
          ) : null}
        </section>
      </div>
    </ProjectsFrame>
  );
}

function ProjectsFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  return embedded ? <>{children}</> : <AiBuilderShell>{children}</AiBuilderShell>;
}

function ViewButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${active ? "bg-white/[.08] text-white" : "text-slate-500 hover:text-slate-200"}`}>{label}<span className={active ? "text-[var(--gold)]" : "text-slate-600"}>{count}</span></button>;
}

function ProjectGrid({ projects, archived, menu, busy, setMenu, onRename, onArchive, onRestore }: { projects: Project[]; archived: boolean; menu: string | null; busy: string | null; setMenu: (id: string | null) => void; onRename: (project: Project) => void; onArchive: (project: Project) => void; onRestore: (project: Project) => void }) {
  if (!projects.length) return <div className="mt-5 rounded-xl border border-white/[.08] bg-[#050505] px-6 py-10 text-center"><p className="text-sm text-slate-400">No {archived ? "archived" : "active"} projects.</p></div>;

  return <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-2">{projects.map((project) => (
    <article key={project.id} className="relative rounded-xl border border-white/[.09] bg-[#070707] px-4 py-3 transition hover:border-amber-300/25">
      <div className="relative min-w-0 px-10 text-center">
        <h3 className="truncate text-base font-black text-white">{project.businessName}</h3>
        <p className="mt-1 truncate text-xs text-slate-500">{domain(project.website)}</p>
        <div className="absolute right-0 top-0">
          <div className="relative shrink-0">
            <button type="button" aria-label={`Actions for ${project.businessName}`} aria-haspopup="menu" aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black text-base text-slate-300 transition hover:border-amber-300/30 hover:text-white">•••</button>
            {menu === project.id ? <div role="menu" className="absolute right-0 top-10 z-20 min-w-[150px] rounded-xl border border-[rgba(212,175,55,.2)] bg-[#050505] p-1.5 shadow-2xl">
              {!archived ? <><button role="menuitem" disabled={busy === project.id} onClick={() => onRename(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.04] hover:text-[var(--gold)]">Rename</button><button role="menuitem" disabled={busy === project.id} onClick={() => onArchive(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10">Archive</button></> : <button role="menuitem" disabled={busy === project.id} onClick={() => onRestore(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-white/[0.04]">Restore</button>}
            </div> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(112px,1fr)_auto_minmax(112px,1fr)] items-center gap-6 border-t border-white/[.07] pt-2">
        <div className="min-w-0 justify-self-end text-center">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-[var(--gold)]">Knowledge model</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-white" title={project.model || "Not available"}>{project.model || "Not available"}</p>
        </div>
        {!archived ? <Link href={`/ai-builder?projectId=${encodeURIComponent(project.id)}`} className="inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2 text-xs font-black text-white transition hover:border-amber-300/30">Open project</Link> : <button type="button" disabled={busy === project.id} onClick={() => onRestore(project)} className="inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2 text-xs font-black text-white transition hover:border-amber-300/30 disabled:opacity-50">Restore</button>}
        <div className="min-w-0 justify-self-start text-center">
          <p className="text-[9px] font-black uppercase tracking-[.12em] text-[var(--gold)]">Created</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-white" title={date(project.createdAt)}>{date(project.createdAt)}</p>
        </div>
      </div>
    </article>
  ))}</div>;
}
