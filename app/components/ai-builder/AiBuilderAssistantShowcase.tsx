"use client";

import { aiBuilderCornerCtaClassName } from "./AiBuilderAuthCta";
import AiBuilderModelSelect, { type AiBuilderModelChoice } from "./AiBuilderModelSelect";

export default function AiBuilderAssistantShowcase({ models }: { models: AiBuilderModelChoice[] }) {
  const showcaseModels = models.length
    ? models
    : [
        { id: "gpt-5.5", displayName: "GPT-5.5", provider: "openai", recommended: true, highUsage: false },
        { id: "claude-sonnet", displayName: "Claude Sonnet", provider: "anthropic", recommended: false, highUsage: false },
        { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "google", recommended: false, highUsage: false },
        { id: "grok-4", displayName: "Grok 4", provider: "xai", recommended: false, highUsage: true },
      ];
  const selectedModel = showcaseModels[0]?.id ?? "";

  return (
    <section className="grid h-full min-h-0 grid-cols-2 overflow-hidden rounded-[20px] border border-white/[0.09] bg-black">
      <div className="relative flex min-h-0 items-start justify-center overflow-hidden border-r border-white/[0.09] bg-[#030303] px-7 pb-4 pt-5">
        <div className="pointer-events-none relative z-20 flex w-full max-w-[430px] items-start justify-center">
          <AiBuilderModelSelect
            models={showcaseModels}
            value={selectedModel}
            disabled={false}
            defaultOpen
            onChange={() => undefined}
            className="w-full [&_[role=listbox]]:max-h-[330px]"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-col bg-[#000000]">
        <header className="flex min-h-[76px] flex-none items-center justify-center border-b border-white/[0.08] px-6 text-center">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.22em] text-amber-300">Business assistant</p>
            <h2 className="mt-1 text-base font-black text-white">Arkena Studio</h2>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-6 py-5">
          <div className="ml-auto w-fit max-w-[82%] rounded-2xl rounded-br-md border border-white/[0.09] bg-[#101010] px-4 py-3 text-sm leading-6 text-slate-200">
            Which service should we lead with for a growing agency that needs better client onboarding?
          </div>

          <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-amber-300/20 bg-[#070707] px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_12px_30px_rgba(0,0,0,.28)]">
            Lead with the AI Builder. It solves the clearest immediate pain: turning scattered business information into a structured assistant that understands services, policies, customers, and brand voice.
            <div className="mt-3 border-t border-white/[0.07] pt-3 text-xs leading-5 text-slate-500">
              Based on your approved Business Knowledge and website sources.
            </div>
          </div>

          <div className="ml-auto w-fit max-w-[76%] rounded-2xl rounded-br-md border border-white/[0.09] bg-[#101010] px-4 py-3 text-sm leading-6 text-slate-200">
            Give me the strongest positioning in one sentence.
          </div>

          <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-amber-300/20 bg-[#070707] px-4 py-3 text-sm leading-6 text-white shadow-[0_12px_30px_rgba(0,0,0,.28)]">
            Build an AI assistant that already understands your business before your customers ever ask the first question.
          </div>
        </div>

        <div className="flex-none border-t border-white/[0.08] p-5">
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-[#080808] p-2 shadow-[0_12px_32px_rgba(0,0,0,.22)]">
            <div className="min-h-[50px] flex-1 px-3 py-3 text-sm text-white">How should I position this for agencies?</div>
            <button type="button" className={`${aiBuilderCornerCtaClassName} min-h-[50px] px-5 text-sm`}>
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
