type Props={onBuild:()=>void};

export default function AiBuilderForm({onBuild}:Props){
return (
<div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
<div className="grid gap-4">
<input className="rounded-lg bg-neutral-950 p-3" placeholder="Business name"/>
<input className="rounded-lg bg-neutral-950 p-3" placeholder="Assistant name"/>
<select className="rounded-lg bg-neutral-950 p-3">
<option>Professional</option>
<option>Friendly</option>
<option>Consultative</option>
</select>
<textarea rows={14} className="rounded-lg bg-neutral-950 p-4"
placeholder="Tell me everything you'd tell a brand new employee on their first day..."/>
<button onClick={onBuild} className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black">
Build My AI
</button>
</div>
</div>
);
}
