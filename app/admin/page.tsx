import Link from "next/link";
import { requireAdmin } from "@/app/lib/admin/auth";
import { getAdminOverview } from "@/app/lib/admin/repository";
import { Badge, KpiCard, PageHeader, card, formatDateTime } from "./_components/AdminUi";

export default async function AdminOverviewPage() {
  await requireAdmin(); const data = await getAdminOverview();
  return <div className="space-y-7"><PageHeader eyebrow="Operations" title="Dashboard overview" description="A live view of AI Builder customers, project momentum, and purchase intent." />
    <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard label="Total users" value={data.users} detail="Authenticated owners" accent="blue" />
      <KpiCard label="Total projects" value={data.projects} detail="All builder workspaces" />
      <KpiCard label="Active projects" value={data.activeProjects} detail="Currently in progress" accent="green" />
      <KpiCard label="Purchase requests" value={data.purchases} detail="Sales conversations" />
      <KpiCard label="Created today" value={data.createdToday} detail="New project starts" accent="blue" />
    </section>
    <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-amber-300/10 px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300/60">Activity stream</p><h2 className="mt-1 text-lg font-semibold text-white">What’s happening now</h2></div><Badge tone="gold">Live data</Badge></div>
      <div className="p-3 sm:p-4"><div className="space-y-2">{data.activity.length ? data.activity.map((item) => <div key={item.id} className="group flex items-center gap-4 rounded-2xl border border-transparent px-3 py-3 transition hover:border-amber-300/15 hover:bg-[#081226]/70"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/[.06]"><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,.5)]"/></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{item.label}</p><p className="truncate text-xs text-slate-500">{item.detail}</p></div>{item.projectId && <Link href={`/admin/projects/${item.projectId}`} className="rounded-xl border border-amber-300/15 bg-[#081226] px-3 py-2 text-xs font-bold text-amber-200 transition hover:border-amber-300/35">Review →</Link>}<time className="hidden min-w-28 text-right text-xs text-slate-600 lg:block">{formatDateTime(item.occurredAt)}</time></div>) : <p className="px-5 py-12 text-center text-sm text-slate-500">No activity has been recorded yet.</p>}</div></div>
    </section></div>;
}
