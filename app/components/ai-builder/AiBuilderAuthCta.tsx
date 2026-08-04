"use client";

import { SignedOut, SignInButton } from "@clerk/nextjs";

export const aiBuilderCornerCtaClassName =
  "cta-raised inline-flex min-h-[34px] items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111]";

export default function AiBuilderAuthCta() {
  return (
    <>
      <style>{`
        .ai-builder-form [class~="border-amber-300/20"][class~="bg-[#070707]/88"] {
          border-color: rgba(255, 255, 255, 0.07) !important;
          background: #070707 !important;
        }
      `}</style>
      <div className="absolute right-4 top-4 z-10 flex justify-end sm:right-6 lg:right-8">
        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl="/brain-builder">
            <button type="button" className={aiBuilderCornerCtaClassName}>
              Sign In
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </>
  );
}
