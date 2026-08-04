"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderLanding from "./AiBuilderLanding";
import { aiBuilderCornerCtaClassName } from "./AiBuilderAuthCta";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

export type AiBuilderProjectPreview = {
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

type Project = AiBuilderProjectPreview;
type ProjectView = "active" | "archived";

type Props = {
  embedded?: boolean;
  onClose?: () => void;
  showcaseProjects?: AiBuilderProjectPreview[];
};

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

export default function AiBuilderProjects({ embedded = false, onClose, showcaseProjects }: Props = {}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const showcase = Array.isArray(showcaseProjects);
  const [projects, setProjects] = useState<Project[]>(showcaseProjects ?? []);
  const [loading, setLoading] = useState(!showcase);
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
    if (showcase) {
      setProjects(showcaseProjects ?? []);
      setError(null);
      setLoading(false);
      return;
    }
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
  }, [isLoaded, isSignedIn, router, showcase, showcaseProjects]);

  async function rename(project: Project) {
    if (showcase) return;
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
    if (showcase) return;
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
    if (showcase) return;
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

  if (!showcase && isLoaded && !isSignedIn) return <AiBuilderShell><AiBuilderLanding /></AiBuilderShell>;

  const presentationClassName = showcase
    ? "h-full w-full overflow-hidden bg-black"
    : "contents min-[1200px]:fixed min-[1200px]:inset-0 min-[1200px]:z-[100] min-[1200px]:flex min-[1200px]:items-center min-[1200px]:justify-center min-[1200px]:bg-black/75 min-[1200px]:p-8 min-[1200px]:backdrop-blur-md";
  const sectionClassName = showcase
    ? "relative h-full w-full overflow-y-auto bg-[#030303] px-6 py-6"
    : "relative w-full bg-black px-4 py-7 sm:px-6 sm:py-9 min-[1200px]:flex min-[1200px]:max-h-[90dvh] min-[1200px]:max-w-[1100px] min-[1200px]:flex-col min-[1200px]:overflow-y-auto min-[1200px]:rounded-[24px] min-[1200px]:border min-[1200px]:border-white/[0.1] min-[1200px]:bg-[#030303] min-[1200px]:px-10 min-[1200px]:py-6 min-[1200px]:shadow-[0_32px_110px_rgba(0,0,0,0.72)]";

  return (
    <ProjectsFrame embedded={embedded || showcase}>
      {showcase ? null : confirmDialogNode}
      <div role="presentation" className={presentationClassName}>
        <section role={showcase ? undefined : "dialog"} aria-modal={showcase ? undefined : true} aria-label="AI Builder projects" className={sectionClassName}>
          {onClose && !showcase ? <button type="button" onClick={onClose} className="absolute right-6 top-4 z-10 hidden rounded-lg border border-white/[0.1] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white min-[1200px]:inline-flex">Done</button> : null}

          {error ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          {loading ? <div className="rounded-2xl border border-white/[.08] bg-[#050505] p-12 text-center text-slate-400">Loading your projects…</div> : null}

          {(showcase || isSignedIn) && !loading && projects.length ? (
            <div>
              <div className="flex justify-center border-b border-white/[.08] pb-3">
                <div className="flex items-center gap-1.5 rounded-xl border border-white/[.08] bg-[#050505] p-1 sm:gap-2 sm:p-1.5">
                  <ViewButton active={view === "active"} label="Active" count={openProjects.length} onClick={() => { setView("active"); setMenu(null); }} />
                  <ViewButton active={view === "archived"} label="Archived" count={archivedProjects.length} onClick={() => { setView("archived"); setMenu(null); }} />
                </div>
              </div>

              <ProjectGrid projects={visibleProjects} archived={view === "archived"} menu={menu} busy={busy} setMenu={setMenu} onRename={rename} onArchive={archive} onRestore={restore} showcase={showcase} />
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
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${active ? "bg-white/[.08] text-white" : "text-slate-500 hover:text-slate-200"}`}>{label}<span className={active ? "text-[var(--gold)]" : "text-slate-600"}>{count}</span></button>;
}

function ProjectGrid({ projects, archived, menu, busy, setMenu, onRename, onArchive, onRestore, showcase }: { projects: Project[]; archived: boolean; menu: string | null; busy: string | null; setMenu: (id: string | null) => void; onRename: (project: Project) => void; onArchive: (project: Project) => void; onRestore: (project: Project) => void; showcase: boolean }) {
  if (!projects.length) return <div className="mt-5 rounded-xl border border-white/[.08] bg-[#050505] px-6 py-10 text-center"><p className="text-sm text-slate-400">No {archived ? "archived" : "active"} projects.</p></div>;

  return <div className="mt-4 grid gap-2.5 sm:mt-5 sm:gap-3 md:grid-cols-2 xl:grid-cols-2">{projects.map((project) => (
    <article key={project.id} className="relative rounded-xl border border-white/[.09] bg-[#070707] px-2.5 py-3 transition hover:border-amber-300/25 sm:px-4 sm:py-4">
      <div className="relative grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4">
        <div className="relative self-center">
          <button type="button" disabled={showcase} aria-label={`Actions for ${project.businessName}`} aria-haspopup="menu" aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)} className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black text-xs text-slate-300 transition hover:border-amber-300/30 hover:text-white disabled:cursor-default sm:h-8 sm:w-8 sm:rounded-lg sm:text-base">•••</button>
          {menu === project.id ? <div role="menu" className="absolute left-0 top-9 z-20 min-w-[132px] rounded-xl border border-[rgba(212,175,55,.2)] bg-[#050505] p-1 shadow-2xl sm:top-10 sm:min-w-[150px] sm:p-1.5">
            {!archived ? <><button role="menuitem" disabled={busy === project.id} onClick={() => onRename(project)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[10px] font-semibold text-slate-200 hover:bg-white/[0.04] hover:text-[var(--gold)] sm:px-3 sm:py-2 sm:text-xs">Rename</button><button role="menuitem" disabled={busy === project.id} onClick={() => onArchive(project)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[10px] font-semibold text-red-300 hover:bg-red-500/10 sm:px-3 sm:py-2 sm:text-xs">Archive</button></> : <button role="menuitem" disabled={busy === project.id} onClick={() => onRestore(project)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[10px] font-semibold text-amber-300 hover:bg-white/[0.04] sm:px-3 sm:py-2 sm:text-xs">Restore</button>}
          </div> : null}
        </div>

        <div className="min-w-0 text-left">
          <h3 className="truncate text-[11px] font-black leading-4 text-white sm:text-base sm:leading-normal">{project.businessName}</h3>
          <p className="mt-0.5 truncate text-[9px] leading-3 text-slate-500 sm:mt-1 sm:text-xs sm:leading-normal">{domain(project.website)}</p>
        </div>

        <div className="absolute left-1/2 top-1/2 w-[4.5rem] -translate-x-1/2 -translate-y-1/2 text-center sm:w-[118px]">
          <p className="w-full truncate text-center text-[7px] font-black uppercase tracking-[.08em] text-slate-500 sm:text-[9px] sm:tracking-[.12em]">Knowledge model</p>
          <p className="mt-0.5 truncate text-[8px] font-semibold leading-3 text-white sm:mt-1 sm:text-[11px] sm:leading-normal" title={project.model || "Not available"}>{project.model || "Not available"}</p>
        </div>

        <div className="flex min-w-0 justify-end">
          {!archived ? (
            showcase ? (
              <span className={`${aiBuilderCornerCtaClassName} !min-h-0 !rounded-md !px-2 !py-1.5 !text-[8px] sm:!rounded-lg sm:!px-3 sm:!py-2 sm:!text-xs`}>Open</span>
            ) : (
              <Link href={`/ai-builder?projectId=${encodeURIComponent(project.id)}&tab=dashboard`} className={`${aiBuilderCornerCtaClassName} !min-h-0 !rounded-md !px-2 !py-1.5 !text-[8px] sm:!rounded-lg sm:!px-3 sm:!py-2 sm:!text-xs`}><span className="sm:hidden">Open</span><span className="hidden sm:inline">Open project</span></Link>
            )
          ) : (
            <button type="button" disabled={busy === project.id || showcase} onClick={() => onRestore(project)} className={`${aiBuilderCornerCtaClassName} !min-h-0 !rounded-md !px-2 !py-1.5 !text-[8px] disabled:opacity-50 sm:!rounded-lg sm:!px-3 sm:!py-2 sm:!text-xs`}>Restore</button>
          )}
        </div>
      </div>
    </article>
  ))}</div>;
}