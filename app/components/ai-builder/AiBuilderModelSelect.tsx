"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

export type AiBuilderModelChoice = {
  id: string;
  provider: string;
  displayName: string;
  /** Retained in the server projection for compatibility; intentionally not rendered. */
  recommended: boolean;
  highUsage: boolean;
  selectableForPurpose?: boolean;
};

const providerNames: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
  deepseek: "DeepSeek",
};

export default function AiBuilderModelSelect({models,value,disabled,onChange,className="",defaultOpen=false}:{models:AiBuilderModelChoice[];value:string;disabled:boolean;onChange:(modelId:string)=>void;className?:string;defaultOpen?:boolean}) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = models.find((model) => model.id === value);
  const groups = useMemo(() => Array.from(new Set(models.map((model) => model.provider))), [models]);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  useEffect(() => {
    if (!value) return;
    document.cookie = `ai_builder_model_id=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function selectModel(model: AiBuilderModelChoice) {
    setOpen(false);

    if (model.selectableForPurpose === false) {
      await showConfirm({
        title: "Claude is available for chat only",
        message:
          "Claude currently has limits that can reduce Business Knowledge extraction quality. Please choose another model for Business Knowledge generation. Claude remains available for AI assistant conversations.",
        cancelLabel: "Close",
        confirmLabel: "Got it",
      });
      return;
    }

    onChange(model.id);
  }

  return (
    <>
      <div ref={rootRef} className={`relative grid min-w-0 justify-items-center gap-1.5 ${className}`}>
        <span className="text-center text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-400">Active model</span>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} disabled={disabled || !value} onClick={() => setOpen((current) => !current)} className="cta-raised relative h-10 w-[min(21rem,calc(100vw-3rem))] rounded-lg border border-amber-300/20 bg-black px-10 text-center text-sm font-semibold text-white outline-none transition hover:border-amber-300/40 focus-visible:border-amber-300/45 disabled:cursor-not-allowed disabled:opacity-50">
          <span className="block truncate">{selected?.displayName || "Select a model"}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70 transition ${open ? "rotate-180" : ""}`}><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open && !disabled ? <div role="listbox" aria-label="Available AI models" className="absolute left-1/2 top-full z-[100] mt-2 max-h-[min(28rem,65vh)] w-[min(21rem,calc(100vw-3rem))] -translate-x-1/2 overflow-y-auto rounded-xl border border-amber-300/20 bg-[#050505] p-2 shadow-[0_24px_70px_rgba(0,0,0,.75)]">
          {groups.map((provider) => <div key={provider} className="py-1 first:pt-0 last:pb-0">
            <p className="px-3 pb-1.5 pt-2 text-left text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-500">{providerNames[provider] ?? provider}</p>
            <div className="space-y-0.5">{models.filter((model) => model.provider === provider).map((model) => <button key={model.id} type="button" role="option" aria-selected={model.id === value} onClick={() => void selectModel(model)} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition ${model.id === value ? "border-amber-300/20 bg-black text-white" : "border-transparent text-slate-300 hover:border-white/[0.08] hover:bg-black hover:text-white"}`}><span className="min-w-0 truncate">{model.displayName}</span>{model.highUsage ? <span className="shrink-0 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-amber-200">High usage</span> : null}</button>)}</div>
          </div>)}
        </div> : null}
      </div>
      {confirmDialogNode}
    </>
  );
}
