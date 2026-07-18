import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/app/lib/admin/auth";
import { getAdminProjectDetail } from "@/app/lib/admin/repository";
import { getImpersonationCapability } from "@/app/lib/admin/impersonation";
import { Badge, PageHeader, card, formatDateTime } from "../../_components/AdminUi";
import { Communications, CustomerEditor, Diagnostics, ImpersonationPanel, InternalNotes } from "./ProjectOperations";

type Row = Record<string, unknown>;
const value = (row: Row, key: string) => String(row[key] ?? "");
const when = (row: Row, key: string) => row[key] ? formatDateTime(new Date(String(row[key])).toISOString()) : "—";

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className={`${card} overflow-hidden`}><div className="border-b border-white/[.06] px-5 py-4"><h2 className="font-black text-white">{title}</h2>{subtitle&&<p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div><div className="p-5">{children}</div></section>;
}

export default async function AdminProjectDetailPage({ params }: { params: { projectId: string } }) {
  await requireAdmin(); const data=await getAdminProjectDetail(params.projectId); if(!data) notFound(); const {project}=data; const impersonation=await getImpersonationCapability();
  return <div className="space-y-6"><Link href="/admin/projects" className="text-sm font-bold text-slate-400 hover:text-amber-300">← All projects</Link>
    <PageHeader eyebrow="Internal review" title={project.businessName} description={`Complete read-only visibility for project ${project.id}.`} action={<Badge tone={project.status==="ready"?"good":"gold"}>{project.status}</Badge>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Owner",project.ownerName||"Anonymous visitor"],["Email",project.ownerEmail||"Not collected"],["Industry",project.industry],["Website",project.website||"Not connected"]].map(([k,v])=><div key={k} className={`${card} p-5`}><p className="text-[11px] font-black uppercase tracking-[.13em] text-slate-500">{k}</p><p className="mt-2 break-words text-sm font-bold text-white">{v}</p></div>)}</div>
    <CustomerEditor project={project}/>
    <div className="grid gap-6">
      <Section title="Workflow progress" subtitle={`${data.progress.length} recorded events`}><div className="space-y-3">{data.progress.length?data.progress.map((r,i)=><div key={`${value(r,"id")}-${i}`} className="flex gap-3 rounded-xl border border-white/[.06] bg-white/[.02] p-3"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${r.completed?"bg-emerald-400":"bg-amber-300"}`}/><div><p className="text-sm font-bold text-white">{value(r,"message")}</p><p className="mt-1 text-xs capitalize text-slate-500">{value(r,"stage")} · {when(r,"created_at")}</p></div></div>):<p className="text-sm text-slate-500">No workflow events recorded.</p>}</div></Section>
    </div>
    <Diagnostics crawlAttempts={data.crawlTelemetry} generationAttempts={data.generationTelemetry}/>
    <InternalNotes projectId={project.id} notes={data.notes}/>
    <Section title="Business knowledge" subtitle={`${data.knowledge.length} entries`}><div className="grid gap-3 lg:grid-cols-2">{data.knowledge.length?data.knowledge.map(r=><article key={value(r,"id")} className="rounded-xl border border-white/[.07] bg-[#030713] p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-white">{value(r,"title")}</h3><Badge>{value(r,"status")}</Badge></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{value(r,"content")}</p><p className="mt-3 text-xs capitalize text-slate-600">{value(r,"category")} · confidence {value(r,"confidence")}</p></article>):<p className="text-sm text-slate-500">No knowledge entries.</p>}</div></Section>
    <Section title="Generated Q&A" subtitle={`${data.faqs.length} generated answers`}><div className="space-y-3">{data.faqs.length?data.faqs.map(r=><details key={value(r,"id")} className="rounded-xl border border-white/[.07] bg-[#030713] p-4"><summary className="cursor-pointer font-bold text-white">{value(r,"question")}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{value(r,"answer")}</p></details>):<p className="text-sm text-slate-500">No generated Q&A.</p>}</div></Section>
    <Section title="Demo chat history" subtitle={`${data.threads.filter(r=>r.content).length} messages`}><div className="space-y-3">{data.threads.some(r=>r.content)?data.threads.filter(r=>r.content).map((r,i)=><div key={`${value(r,"id")}-${i}`} className={`max-w-3xl rounded-2xl border p-4 ${value(r,"role")==="user"?"ml-auto border-amber-300/15 bg-amber-300/[.05]":"border-white/[.07] bg-[#030713]"}`}><div className="flex justify-between gap-3 text-xs"><span className="font-black uppercase tracking-wider text-slate-500">{value(r,"role")}</span><time className="text-slate-600">{when(r,"message_created_at")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{value(r,"content")}</p></div>):<p className="text-sm text-slate-500">No demo messages recorded.</p>}</div></Section>
    <Communications rows={data.communications}/>
    <ImpersonationPanel customer={project.ownerEmail||project.businessName} reason={impersonation.available?"Available":impersonation.reason}/>
    <div className="grid gap-6 xl:grid-cols-2"><Section title="Purchase request history"><div className="space-y-3">{data.purchases.length?data.purchases.map(r=><div key={value(r,"id")} className="rounded-xl border border-white/[.07] p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-white">Purchase requested</p><p className="mt-1 text-xs text-slate-500">{when(r,"created_at")}</p></div><Badge tone="gold">{value(r,"status")||"new"}</Badge></div><p className="mt-3 text-xs capitalize text-slate-400">Follow-up: {(value(r,"follow_up_stage")||"new").replaceAll("_"," ")}</p>{value(r,"internal_comments")&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{value(r,"internal_comments")}</p>}</div>):<p className="text-sm text-slate-500">No purchase requests.</p>}</div></Section>
      <Section title="Metadata & timestamps"><dl className="space-y-3 text-sm">{[["Project ID",project.id],["Created",formatDateTime(project.createdAt)],["Updated",formatDateTime(project.updatedAt)],["Expires",project.expiresAt?formatDateTime(project.expiresAt):"Never"],["Knowledge counts",JSON.stringify(project.counts)],["Assistant configuration",JSON.stringify(project.configuration)]].map(([k,v])=><div key={k} className="grid gap-1 border-b border-white/[.05] pb-3 sm:grid-cols-[150px_1fr]"><dt className="text-slate-500">{k}</dt><dd className="break-all text-slate-300">{v}</dd></div>)}</dl></Section></div>
    <Section title="Original business intake" subtitle={`${data.intake.length} submitted blocks`}><div className="space-y-3">{data.intake.map(r=><article key={value(r,"id")} className="rounded-xl border border-white/[.07] bg-[#030713] p-4"><h3 className="font-bold text-white">{value(r,"label")}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{value(r,"content")}</p></article>)}</div></Section>
  </div>;
}
