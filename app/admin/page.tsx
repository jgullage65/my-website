import Link from "next/link";
import { requireAdmin } from "@/app/lib/admin/auth";
import { getAdminOverview } from "@/app/lib/admin/repository";
import { Badge, PageHeader, card, formatDateTime } from "./_components/AdminUi";

export default async function AdminOverviewPage() {
  await requireAdmin(); const data = await getAdminOverview();
  const stats = [["Total users", data.users], ["Total projects", data.projects], ["Active projects", data.activeProjects], ["Purchase requests", data.purchases], ["Created today", data.createdToday]];
  return <div className="space-y-8"><PageHeader eyebrow="Operations" title="Dashboard overview" description="A private, read-only view of AI Builder usage, project progress, and purchase intent." />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.map(([label,value]) => <article key={label} className={`${card} p-5`}><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{value}</p></article>)}</section>
    <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-white/[.06] px-5 py-4"><div><h2 className="font-black text-white">Recent activity</h2><p className="mt-1 text-xs text-slate-500">Latest events across the AI Builder</p></div><Badge tone="gold">Live data</Badge></div>
      <div className="divide-y divide-white/[.05]">{data.activity.length ? data.activity.map((item) => <div key={item.id} className="flex items-center gap-4 px-5 py-4"><span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,.5)]"/><div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{item.label}</p><p className="truncate text-xs text-slate-500">{item.detail}</p></div>{item.projectId && <Link href={`/admin/projects/${item.projectId}`} className="text-xs font-bold text-amber-300 hover:text-amber-200">Review</Link>}<time className="hidden text-xs text-slate-500 sm:block">{formatDateTime(item.occurredAt)}</time></div>) : <p className="px-5 py-12 text-center text-sm text-slate-500">No activity has been recorded yet.</p>}</div>
    </section></div>;
}
