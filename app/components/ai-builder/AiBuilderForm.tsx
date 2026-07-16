import type { BuilderState } from "./AiBuilderClient";

type Props={
  value:BuilderState;
  onChange:(value:BuilderState)=>void;
  onBuild:()=>void;
};

export default function AiBuilderForm({value,onChange,onBuild}:Props){
  const update=(key:keyof BuilderState,val:string)=>onChange({...value,[key]:val});
  const valid=value.businessName.trim()&&value.assistantName.trim()&&value.description.trim();

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="grid gap-4">
        <input className="rounded-lg bg-neutral-950 p-3" placeholder="Business name" value={value.businessName} onChange={e=>update("businessName",e.target.value)}/>
        <input className="rounded-lg bg-neutral-950 p-3" placeholder="Assistant name" value={value.assistantName} onChange={e=>update("assistantName",e.target.value)}/>
        <select className="rounded-lg bg-neutral-950 p-3" value={value.tone} onChange={e=>update("tone",e.target.value)}>
          <option>Professional</option><option>Friendly</option><option>Consultative</option>
        </select>
        <textarea rows={14} className="rounded-lg bg-neutral-950 p-4" placeholder="Tell me everything about your business..." value={value.description} onChange={e=>update("description",e.target.value)}/>
        <button disabled={!valid} onClick={onBuild} className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black disabled:opacity-50">
          Build My AI
        </button>
      </div>
    </div>
  );
}
