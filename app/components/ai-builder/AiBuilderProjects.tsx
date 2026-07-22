"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderAuthCta from "./AiBuilderAuthCta";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

type Project = {
  id: string; businessName: string; website: string | null; industry: string;
  status: string; messageCount: number; createdAt: string; updatedAt: string;
  archivedAt: string | null;
};

const PROJECT_LIMIT = 3;
const sectionClassName = "overflow-hidden rounded-[24px] border border-blue-400/25 border-t-2 border-t-amber-300/70 bg-[#081226] shadow-[0_18px_48px_rgba(0,0,0,.28)]";

function date(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AiBuilderProjects() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openExpanded, setOpenExpanded] = useState(true);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();
  const openProjects = useMemo(() => projects.filter((project) => !project.archivedAt), [projects]);
  const archivedProjects = useMemo(() => projects.filter((project) => project.archivedAt), [projects]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setProjects([]); setError(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error("Your projects could not be loaded. Please sign in again.");
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Projects could not be loaded.");
        if (!cancelled) setProjects(payload.projects);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Projects could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  async function beginProjectCreation() {
    if (projects.length < PROJECT_LIMIT) { router.push("/ai-builder?new=1"); return; }
    const contact = await showConfirm({
      title: "Project Limit Reached",
      message: "You've reached your current project limit of 3 projects.\n\nContact James to discuss purchasing a current project or increasing your project limit.",
      cancelLabel: "Cancel", confirmLabel: "Contact James",
    });
    if (contact) router.push("/contact");
  }

  async function rename(project: Project) {
    const businessName = window.prompt("Rename project", project.businessName)?.trim();
    if (!businessName || businessName === project.businessName) return;
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, businessName, updatedAt: new Date().toISOString() } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The project could not be renamed."); }
    finally { setBusy(null); setMenu(null); }
  }

  async function archive(project: Project) {
    const confirmed = await showConfirm({ title: `Archive ${project.businessName}?`, message: "This removes the project from your active projects without deleting its saved knowledge or chat history.", confirmLabel: "Archive", cancelLabel: "Cancel" });
    if (!confirmed) return;
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      const now = new Date().toISOString();
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, archivedAt: now, updatedAt: now } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The project could not be archived."); }
    finally { setBusy(null); setMenu(null); }
  }

  async function restore(project: Project) {
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restore: true }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      const now = new Date().toISOString();
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, archivedAt: null, updatedAt: now } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The project could not be restored."); }
    finally { setBusy(null); setMenu(null); }
  }

  return (
    <AiBuilderShell>
      {confirmDialogNode}
      <div className="relative mx-auto max-w-6xl rounded-[30px] border border-white/[0.09] bg-[#030713] px-4 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:py-10">
        <AiBuilderAuthCta />
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">AI Builder</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">Your <span className="text-[var(--gold)]">Projects</span></h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">Continue building and refining your business AI systems.</p>
          {isSignedIn && !loading && projects.length ? <button type="button" onClick={() => void beginProjectCreation()} className="mt-6 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">New AI Builder Project</button> : null}
        </div>

        {error ? <div className="mt-6 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {loading ? <div className="mt-10 rounded-[30px] border border-amber-300/20 bg-[#030713] p-12 text-center text-slate-400">Loading your projects…</div> : null}
        {isSignedIn && !loading && !projects.length ? (
          <div className="mt-10 rounded-[30px] border border-amber-300/20 bg-[#030713] px-6 py-16 text-center shadow-[0_24px_90px_rgba(0,0,0,.34)]">
            <h2 className="text-2xl font-black tracking-[-.035em]">Build your first business AI</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-400">Create a project and your work will be saved here whenever you return.</p>
            <button type="button" onClick={() => void beginProjectCreation()} className="mt-7 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">Create Your First AI Builder Project</button>
          </div>
        ) : null}

        {isSignedIn && !loading && projects.length ? <div className="mt-10 space-y-5">
          <ProjectSection title="Open Projects" expanded={openExpanded} onToggle={() => setOpenExpanded((value) => !value)} count={openProjects.length}>
            <ProjectGrid projects={openProjects} archived={false} menu={menu} busy={busy} setMenu={setMenu} onRename={rename} onArchive={archive} onRestore={restore} />
          </ProjectSection>
          <ProjectSection title="Archived Projects" expanded={archivedExpanded} onToggle={() => setArchivedExpanded((value) => !value)} count={archivedProjects.length}>
            <ProjectGrid projects={archivedProjects} archived menu={menu} busy={busy} setMenu={setMenu} onRename={rename} onArchive={archive} onRestore={restore} />
          </ProjectSection>
        </div> : null}
      </div>
    </AiBuilderShell>
  );
}

function ProjectSection({ title, expanded, onToggle, count, children }: { title: string; expanded: boolean; onToggle: () => void; count: number; children: React.ReactNode }) {
  return <section className={sectionClassName}>
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-5 py-4 text-left text-white sm:px-6">
      <span aria-hidden="true" className={`text-sm text-[var(--gold)] transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}>▶</span>
      <h2 className="text-lg font-black tracking-[-.025em] sm:text-xl">{title}</h2>
      <span className="ml-auto text-sm font-bold text-slate-400">{count}</span>
    </button>
    <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="overflow-hidden"><div className="border-t border-blue-400/15 p-5 sm:p-6">{children}</div></div></div>
  </section>;
}

function ProjectGrid({ projects, archived, menu, busy, setMenu, onRename, onArchive, onRestore }: { projects: Project[]; archived: boolean; menu: string | null; busy: string | null; setMenu: (id: string | null) => void; onRename: (project: Project) => void; onArchive: (project: Project) => void; onRestore: (project: Project) => void }) {
  if (!projects.length) return <p className="py-5 text-center text-sm text-slate-400">No {archived ? "archived" : "open"} projects.</p>;
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <article key={project.id} className="group relative rounded-3xl border border-amber-300/25 bg-[#030713] p-6 transition-colors hover:border-amber-300/40">
    <div className="absolute right-4 top-4"><div className="relative">
      <button type="button" aria-label={`Actions for ${project.businessName}`} aria-haspopup="menu" aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-300/15 bg-[#030713] text-xl text-slate-300 hover:border-amber-300/30">•••</button>
      {menu === project.id ? <div role="menu" className="absolute right-0 top-11 z-20 min-w-[160px] rounded-xl border border-[rgba(212,175,55,.2)] bg-[#030713] p-1.5 shadow-2xl">
        {!archived ? <><Link role="menuitem" href={`/ai-builder?projectId=${encodeURIComponent(project.id)}`} className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.04] hover:text-[var(--gold)]">Open</Link><button role="menuitem" disabled={busy === project.id} onClick={() => onRename(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-white/[0.04] hover:text-[var(--gold)]">Rename</button><button role="menuitem" disabled={busy === project.id} onClick={() => onArchive(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10">Archive</button></> : <button role="menuitem" disabled={busy === project.id} onClick={() => onRestore(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-amber-300 hover:bg-white/[0.04]">Restore</button>}
      </div> : null}
    </div></div>
    <div className="block pt-5 text-center">
      <h3 className="mx-auto max-w-[85%] text-2xl font-black tracking-[-.035em] text-[var(--gold)]">{project.businessName}</h3>
      <p className="mt-3 truncate text-sm text-slate-400">{project.website || "No website added"}</p>
      <p className="mx-auto mt-5 line-clamp-3 max-w-sm text-sm font-medium leading-6 text-slate-300">{project.industry}</p>
      <dl className="mt-6 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400"><div className="flex justify-between gap-3"><dt>Updated</dt><dd className="text-right text-slate-300">{date(project.updatedAt)}</dd></div><div className="flex justify-between gap-3"><dt>Created</dt><dd className="text-right text-slate-300">{date(project.createdAt)}</dd></div><div className="flex justify-between gap-3"><dt>Chat messages</dt><dd className="font-bold text-slate-300">{project.messageCount}</dd></div></dl>
    </div>
  </article>)}</div>;
}
