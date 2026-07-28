"use client";

export type AiBuilderModelChoice = {
  id: string;
  provider: string;
  displayName: string;
  /** Retained in the server projection for compatibility; intentionally not rendered. */
  recommended: boolean;
  highUsage: boolean;
};

const providerNames: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
  deepseek: "DeepSeek",
};

export default function AiBuilderModelSelect({models,value,disabled,onChange,className=""}:{models:AiBuilderModelChoice[];value:string;disabled:boolean;onChange:(modelId:string)=>void;className?:string}) {
  return (
    <label className={`grid min-w-0 justify-items-center gap-1.5 ${className}`}>
      <span className="text-center text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-400">Active model</span>
      <span className="relative block">
        <select aria-label="Active AI model" value={value} disabled={disabled||!value} onChange={event=>onChange(event.target.value)} className="h-10 w-[min(21rem,calc(100vw-5rem))] appearance-none rounded-xl border border-amber-300/25 bg-black px-4 pr-10 text-center text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,.3),inset_0_1px_0_rgba(255,255,255,.04)] outline-none transition hover:border-amber-300/45 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50">
          {Array.from(new Set(models.map(model=>model.provider))).map(provider=><optgroup key={provider} label={providerNames[provider]??provider}>{models.filter(model=>model.provider===provider).map(model=><option key={model.id} value={model.id}>{model.displayName}{model.highUsage?" · High AI Usage":""}</option>)}</optgroup>)}
        </select>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </label>
  );
}
