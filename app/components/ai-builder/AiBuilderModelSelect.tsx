"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import { MODEL_REGISTRY } from "@/app/lib/ai-engine/models/registry";

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
  arkena: "Arkena Studio",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
  deepseek: "DeepSeek",
};

const demoModel: AiBuilderModelChoice = {
  id: "arkena-studio-demo",
  provider: "arkena",
  displayName: "Arkena Studio",
  recommended: false,
  highUsage: false,
};

const demoModels: AiBuilderModelChoice[] = MODEL_REGISTRY
  .filter(
    (model) =>
      model.enabled &&
      Boolean(model.gatewayModelId) &&
      model.selectablePurposes.includes("test-assistant"),
  )
  .map((model) => ({
    id: model.id,
    provider: model.provider,
    displayName: model.displayName,
    recommended: model.recommended,
    highUsage: model.highUsage,
  }));

export default function AiBuilderModelSelect({models,value,disabled,onChange,className="",defaultOpen=false}:{models:AiBuilderModelChoice[];value:string;disabled:boolean;onChange:(modelId:string)=>void;className?:string;defaultOpen?:boolean}) {
  const [open, setOpen] = useState(defaultOpen);
  const [interactiveDemo, setInteractiveDemo] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const effectiveModels = interactiveDemo ? [demoModel, ...demoModels] : models;
  const effectiveValue = interactiveDemo ? demoModel.id : value;
  const selected = effectiveModels.find((model) => model.id === effectiveValue);
  const groups = useMemo(() => Array.from(new Set(effectiveModels.map((model) => model.provider))), [effectiveModels]);
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  useEffect(() => {
    setInteractiveDemo(Boolean(rootRef.current?.closest('[class*="z-[220]"]')));
  }, []);

  useEffect(() => {
    if (!value || interactiveDemo) return;
    document.cookie = `ai_builder_model_id=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [interactiveDemo, value]);

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

    if (interactiveDemo && model.id !== demoModel.id) {
      await showConfirm({
        title: "AI models aren’t available in the demo",
        message:
          "Arkena Studio powers this interactive preview. Create your own Business Brain to choose from the available AI models.",
        cancelLabel: "Close",
        confirmLabel: "Got it",
      });
      return;
    }

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

    if (!interactiveDemo) onChange(model.id);
  }

  return (
    <>
      <div ref={rootRef} className={`relative grid min-w-0 justify-items-center gap-1.5 ${className}`}>
        <span className="text-center text-[0.64rem] font-bold uppercase tracking-[0.2em] text-slate-400">Active model</span>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} disabled={disabled || !effectiveValue} onClick={() => setOpen((current) => !current)} className="cta-raised relative h-10 w-[min(21rem,calc(100vw-3rem))] rounded-lg border border-amber-300/20 bg-black px-10 text-center text-sm font-semibold text-white outline-none transition hover:border-amber-300/40 focus-visible:border-amber-300/45 disabled:cursor-not-allowed disabled:opacity-50">
          <span className="block truncate">{selected?.displayName || "Select a model"}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70 transition ${open ? "rotate-180" : ""}`}><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open && !disabled ? <div role="listbox" aria-label="Available AI models" className="absolute left-1/2 top-full z-[100] mt-2 max-h-[min(28rem,65vh)] w-[min(21rem,calc(100vw-3rem))] -translate-x-1/2 overflow-y-auto rounded-xl border border-amber-300/20 bg-[#050505] p-2 shadow-[0_24px_70px_rgba(0,0,0,.75)]">
          {groups.map((provider) => <div key={provider} className="py-1 first:pt-0 last:pb-0">
            <p className="px-3 pb-1.5 pt-2 text-left text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-500">{providerNames[provider] ?? provider}</p>
            <div className="space-y-0.5">{effectiveModels.filter((model) => model.provider === provider).map((model) => <button key={model.id} type="button" role="option" aria-selected={model.id === effectiveValue} onClick={() => void selectModel(model)} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition ${model.id === effectiveValue ? "border-amber-300/20 bg-black text-white" : "border-transparent text-slate-300 hover:border-white/[0.08] hover:bg-black hover:text-white"}`}><span className="min-w-0 truncate">{model.displayName}</span>{model.highUsage ? <span className="shrink-0 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-amber-200">High usage</span> : null}</button>)}</div>
          </div>)}
        </div> : null}
      </div>
      {confirmDialogNode}
    </>
  );
}
