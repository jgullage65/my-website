"use client";

import { useAiBuilderWorkspace } from "./AiBuilderWorkspaceContext";

type Destination="knowledge"|"sources"|"settings"|"assistant";
const date=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
const freshness=(value:string)=>{const days=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86_400_000));return days===0?"Updated today":days===1?"Updated yesterday":`Updated ${days} days ago`};

export default function AiBuilderDashboard({showcase=false}:{showcase?:boolean}){
 const workspace=useAiBuilderWorkspace();
 const {session,websiteKnowledge,messages,diagnostics}=workspace;
 const onNavigate=(destination:Destination)=>{
  if(destination==="assistant"){
   document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Ask about"]')?.focus();
   return;
  }
  workspace.setActiveTab(destination);
 };
 const pending=[...session.contextEntries,...session.faqEntries].filter(item=>item.status==="proposed").length;
 const unresolvedConflicts=session.conflicts.filter(item=>!item.resolved).length,missing=session.missingInformation.filter(item=>!item.resolved).length,warnings=websiteKnowledge?.warnings.length??0;
 const websiteConnected=Boolean(websiteKnowledge?.imported_at||session.contextEntries.some(item=>item.source.sourceType==="website"));
 const attention=[pending?{label:`${pending} item${pending===1?"":"s"} waiting for review`,detail:"Approve, correct, or remove proposed knowledge.",action:"knowledge" as const}:null,unresolvedConflicts?{label:`${unresolvedConflicts} unresolved conflict${unresolvedConflicts===1?"":"s"}`,detail:"Resolve contradictory business information.",action:"knowledge" as const}:null,missing?{label:`${missing} information gap${missing===1?"":"s"}`,detail:"Add details the assistant still needs.",action:"knowledge" as const}:null,warnings?{label:`${warnings} website import warning${warnings===1?"":"s"}`,detail:"Review source coverage and skipped content.",action:"sources" as const}:null,!websiteConnected?{label:"No website source connected",detail:"Import a website to broaden the assistant’s source material.",action:"sources" as const}:null,!messages.length?{label:"Assistant has not been tested",detail:"Run a few real customer questions before launch.",action:"assistant" as const}:null].filter((item):item is NonNullable<typeof item>=>Boolean(item));
 const recent=[...session.contextEntries.map(item=>({label:`Knowledge ${item.status}`,detail:item.title,at:item.updatedAt})),...session.faqEntries.map(item=>({label:`Q&A ${item.status}`,detail:item.question,at:item.updatedAt})),...(websiteKnowledge?.imported_at?[{label:"Website imported",detail:`${websiteKnowledge.pages.length} source page${websiteKnowledge.pages.length===1?"":"s"}`,at:websiteKnowledge.imported_at}]:[]),...messages.slice(-3).map(item=>({label:item.role==="user"?"Assistant test question":"Assistant test response",detail:"Demo conversation activity",at:item.createdAt}))].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,6);
 const sourceCounts=session.contextEntries.reduce<Record<string,number>>((counts,item)=>{const key=item.source.sourceType;counts[key]=(counts[key]??0)+1;return counts;},{});
 const sourceFreshness=session.contextEntries.reduce<Record<string,string>>((latest,item)=>{const key=item.source.sourceType;if(!latest[key]||item.updatedAt>latest[key]!)latest[key]=item.updatedAt;return latest;},{});
 const successfulGeneration=diagnostics?.generations.find(item=>item.status==="completed"),completedBuild=session.buildProgress.filter(item=>item.completed&&item.stage==="complete").sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0],lastBuildAt=successfulGeneration?.completed_at??successfulGeneration?.started_at??completedBuild?.createdAt??(session.status==="ready"?session.updatedAt:null);
 const manualKnowledge=session.contextEntries.filter(item=>(item.source.sourceType==="manual_intake"||item.source.sourceType==="user_edit")&&(item.status==="approved"||item.status==="corrected")).length,approvedFaq=session.faqEntries.filter(item=>item.status==="approved").length;
 const hasGeneratedKnowledge=session.contextEntries.length+session.faqEntries.length>0;
 const hasAssistantTest=messages.some(item=>item.role==="user")&&messages.some(item=>item.role==="assistant");
 const readinessChecks=[
  {label:"Source connected",complete:websiteConnected},
  {label:"Knowledge generated",complete:hasGeneratedKnowledge},
  {label:"Review complete",complete:pending===0&&unresolvedConflicts===0&&missing===0},
  {label:"Build completed",complete:Boolean(lastBuildAt)},
  {label:"Assistant tested",complete:hasAssistantTest},
 ];
 const completedReadinessChecks=readinessChecks.filter(item=>item.complete).length;
 const readiness=session.status==="failed"?{status:"Build needs attention",reason:"The latest project build did not complete successfully."}:session.status==="draft"||session.status==="extracting"?{status:"Building project intelligence",reason:"The project is still generating and organizing business knowledge."}:pending||unresolvedConflicts||missing?{status:"Review required",reason:"Finish the remaining knowledge review before relying on assistant responses."}:!hasAssistantTest?{status:"Ready for testing",reason:"The knowledge is prepared. Test real questions to validate the assistant."}:{status:"Validation in progress",reason:"The project has completed its core build and has real assistant test activity."};
 const readinessCard=<section className="rounded-xl border border-white/[.08] bg-[#050505] p-5 text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Project readiness</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em] text-white">{readiness.status}</h2><p className="mx-auto mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">{readiness.reason}</p><p className="mt-3 text-xs font-semibold text-slate-300">{completedReadinessChecks} of {readinessChecks.length} readiness checks complete</p><div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-5 gap-y-2">{readinessChecks.map(item=><span key={item.label} className={`text-xs font-medium ${item.complete?"text-emerald-300":"text-slate-600"}`}>{item.complete?"✓":"○"} {item.label}</span>)}</div></section>;
 return <div className={`grid gap-5 pb-2 lg:grid-cols-[.9fr_1.1fr] ${showcase?"h-full lg:items-stretch":""}`}>
  <div className="lg:col-span-2 min-[1200px]:hidden">{readinessCard}</div>
  <div className="space-y-5">
   <section className="rounded-xl border border-white/[.08] bg-[#050505] p-5"><h3 className="text-center text-base font-semibold text-white">Needs attention</h3>{attention.length?<div className="mt-3 divide-y divide-white/[.07]">{attention.map(item=><button key={item.label} type="button" onClick={()=>onNavigate(item.action)} className="group flex w-full items-center justify-between gap-4 py-3.5 text-left"><div><p className="text-sm font-semibold text-white">{item.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p></div><span className="text-amber-300 transition group-hover:translate-x-1">→</span></button>)}</div>:<Empty text="This project has no outstanding review, source, or testing tasks."/>}</section>
   <section className="rounded-xl border border-white/[.08] bg-[#050505] p-5 text-center"><h3 className="text-base font-semibold text-white">Knowledge source mix</h3>{Object.keys(sourceCounts).length?<dl className="mt-4 divide-y divide-white/[.07] text-left">{Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]).map(([source,count])=><div key={source} className="flex items-center justify-between py-3"><dt><span className="text-sm capitalize text-slate-300">{source.replaceAll("_"," ")}</span>{sourceFreshness[source]?<span className="mt-1 block text-xs text-slate-600">{freshness(sourceFreshness[source]!)}</span>:null}</dt><dd className="text-sm font-semibold text-white">{count}</dd></div>)}</dl>:<Empty text="Source composition will appear after knowledge is generated."/>}{websiteKnowledge?.imported_at?<p className="mt-3 text-xs text-slate-500">Website · {freshness(websiteKnowledge.imported_at)}</p>:null}<Action onClick={()=>onNavigate("sources")}>Inspect source material</Action></section>
   <section className="rounded-xl border border-white/[.08] bg-[#050505] p-5 text-center"><h3 className="text-base font-semibold text-white">Last AI build</h3>{lastBuildAt?<><p className="mt-1.5 text-sm text-slate-400">Built {date(String(lastBuildAt))}</p><div className="mt-4 flex flex-wrap justify-center gap-2">{websiteConnected?<BuildSource>Website</BuildSource>:null}{manualKnowledge?<BuildSource>{manualKnowledge} Manual Knowledge</BuildSource>:null}<BuildSource>{approvedFaq} Approved Q&amp;A</BuildSource></div></>:<Empty text="A successful AI build has not been recorded yet."/>}</section>
  </div>
  <div className={showcase?"flex min-h-0 flex-col gap-5":"space-y-5"}>
   <div className="hidden min-[1200px]:block">{readinessCard}</div>
   <section className={`rounded-xl border border-white/[.08] bg-[#050505] p-5 ${showcase?"flex flex-1 flex-col":""}`}><div className="text-center"><h3 className="text-base font-semibold text-white">Recent project changes</h3><p className="mt-1 text-xs text-slate-500">Latest persisted knowledge, import, and assistant activity.</p><Action onClick={()=>onNavigate("settings")}>Project settings</Action></div>{recent.length?<div className="mt-4 divide-y divide-white/[.07]">{recent.map((item,index)=><div key={`${item.label}-${item.at}-${index}`} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-3"><p className="text-[.65rem] font-bold uppercase tracking-[.1em] text-amber-200">{item.label}</p><p className="truncate text-sm text-slate-300">{item.detail}</p><time className="text-xs text-slate-500">{date(item.at)}</time></div>)}</div>:<Empty text="No project changes have been recorded yet."/>}</section>
  </div>
 </div>;
}
function Action({children,onClick}:{children:React.ReactNode;onClick:()=>void}){return <button type="button" onClick={onClick} className="cta-raised mt-4 rounded-lg border border-amber-300/20 bg-black px-3.5 py-2 text-xs font-semibold text-white transition hover:border-amber-300/40">{children}</button>}
function Empty({text}:{text:string}){return <p className="mt-3 border-l border-white/10 py-2 pl-3 text-center text-sm leading-6 text-slate-500">{text}</p>}
function BuildSource({children}:{children:React.ReactNode}){return <span className="rounded-full border border-white/10 bg-black px-3 py-1.5 text-xs font-semibold text-slate-200">✓ {children}</span>}
