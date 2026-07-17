"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AiBuilderShell from "./AiBuilderShell";

type Project = {
  id: string;
  businessName: string;
  website: string | null;
  industry: string;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type Sort = "updated" | "created" | "name";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  extracting: "Building",
  review_required: "Review needed",
  ready: "Ready",
  failed: "Needs attention",
  expired: "Expired",
};

function date(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AiBuilderProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Projects could not be loaded.");
        if (!cancelled) setProjects(payload.projects);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Projects could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return projects
      .filter((project) => !needle || [project.businessName, project.website, project.industry].some((value) => value?.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => sort === "name" ? a.businessName.localeCompare(b.businessName) : new Date(sort === "created" ? b.createdAt : b.updatedAt).getTime() - new Date(sort === "created" ? a.createdAt : a.updatedAt).getTime());
  }, [projects, query, sort]);

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

  async function duplicate(project: Project) {
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}/duplicate`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      window.location.href = `/ai-builder?projectId=${encodeURIComponent(payload.projectId)}`;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The project could not be duplicated."); setBusy(null); setMenu(null); }
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete “${project.businessName}”? This cannot be undone.`)) return;
    setBusy(project.id);
    try {
      const response = await fetch(`/api/ai-builder/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The project could not be deleted."); }
    finally { setBusy(null); setMenu(null); }
  }

  return (
    <AiBuilderShell>
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[.3em] text-[var(--gold)]">AI Builder</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.045em] sm:text-5xl">Your Projects</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">Continue building and refining your business AI systems.</p>
          {!loading && projects.length ? (
            <Link href="/ai-builder?new=1" className="mt-6 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">New AI Builder Project</Link>
          ) : null}
        </div>

        {error ? <p role="status" className="mt-7 text-center text-sm text-slate-400">We couldn’t load saved projects right now. You can still create a new one.</p> : null}
        {!loading && projects.length ? <div className="mt-9 flex flex-col gap-3 rounded-2xl border border-amber-300/15 bg-[#030713]/80 p-3 sm:flex-row">
          <input aria-label="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search business, website, or industry" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#081226] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/40" />
          <select aria-label="Sort projects" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-xl border border-white/10 bg-[#081226] px-4 py-3 text-sm text-slate-200 outline-none focus:border-amber-300/40"><option value="updated">Last Updated</option><option value="created">Created Date</option><option value="name">Business Name</option></select>
        </div> : null}

        {loading ? <div className="mt-10 rounded-[30px] border border-amber-300/20 bg-[#030713] p-12 text-center text-slate-400">Loading your projects…</div> : null}
        {!loading && !projects.length ? <div className="mt-10 rounded-[30px] border border-amber-300/20 bg-[#030713] px-6 py-16 text-center shadow-[0_24px_90px_rgba(0,0,0,.34)]"><h2 className="text-2xl font-black tracking-[-.035em]">Build your first business AI</h2><p className="mx-auto mt-3 max-w-lg text-slate-400">Create a project and your work will be saved here whenever you return.</p><Link href="/ai-builder?new=1" className="mt-7 inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-5 py-3 text-sm font-black text-white shadow-[0_18px_48px_rgba(212,175,55,.24),inset_0_1px_0_rgba(255,255,255,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]">Create Your First AI Builder Project</Link></div> : null}
        {!loading && projects.length && !visible.length ? <div className="mt-8 rounded-2xl border border-white/10 bg-[#030713] p-10 text-center text-slate-400">No projects match your search.</div> : null}

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => <article key={project.id} className="group relative rounded-3xl border border-amber-300/20 bg-[linear-gradient(145deg,rgba(8,18,38,.96),rgba(3,7,19,.96))] p-6 shadow-[0_20px_60px_rgba(0,0,0,.28)] transition hover:-translate-y-1 hover:border-amber-300/40">
            <div className="flex items-start justify-between gap-4"><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[.68rem] font-black uppercase tracking-wider text-amber-200">{statusLabels[project.status] ?? project.status}</span><div className="relative"><button type="button" aria-label={`Actions for ${project.businessName}`} aria-haspopup="menu" aria-expanded={menu === project.id} onClick={() => setMenu(menu === project.id ? null : project.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#081226] text-xl text-slate-300 hover:border-amber-300/30">•••</button>{menu === project.id ? <div role="menu" className="absolute right-0 top-11 z-20 min-w-[160px] rounded-xl border border-[rgba(212,175,55,.2)] bg-[#070d21] p-1.5 shadow-2xl"><Link role="menuitem" href={`/ai-builder?projectId=${encodeURIComponent(project.id)}`} className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-[#0b1830] hover:text-[var(--gold)]">Open</Link><button role="menuitem" disabled={busy === project.id} onClick={() => rename(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-[#0b1830] hover:text-[var(--gold)]">Rename</button><button role="menuitem" disabled={busy === project.id} onClick={() => duplicate(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-[#0b1830] hover:text-[var(--gold)]">Duplicate</button><button role="menuitem" disabled={busy === project.id} onClick={() => remove(project)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10">Delete</button></div> : null}</div></div>
            <Link href={`/ai-builder?projectId=${encodeURIComponent(project.id)}`} className="mt-5 block"><h2 className="truncate text-xl font-black text-white group-hover:text-amber-100">{project.businessName}</h2><p className="mt-2 truncate text-sm text-slate-400">{project.website || "No website added"}</p><p className="mt-1 text-sm font-semibold text-slate-300">{project.industry}</p><dl className="mt-6 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400"><div className="flex justify-between gap-3"><dt>Updated</dt><dd className="text-right text-slate-300">{date(project.updatedAt)}</dd></div><div className="flex justify-between gap-3"><dt>Created</dt><dd className="text-right text-slate-300">{date(project.createdAt)}</dd></div><div className="flex justify-between gap-3"><dt>Chat messages</dt><dd className="font-bold text-slate-300">{project.messageCount}</dd></div></dl></Link>
          </article>)}
        </div>
      </div>
    </AiBuilderShell>
  );
}
