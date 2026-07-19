"use client";

import { SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";

const buttonClassName =
  "cta-raised inline-flex items-center justify-center rounded-lg border border-amber-300/15 bg-[#081226] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#0b1830]";

export default function AiBuilderAuthCta() {
  return (
    <div className="z-10 -mt-5 mb-4 flex justify-end sm:absolute sm:right-6 sm:top-4 sm:mt-0 sm:mb-0 lg:right-8">
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className={buttonClassName}>
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <SignOutButton redirectUrl="/ai-builder?new=1">
          <button type="button" className={buttonClassName}>
            Sign Out
          </button>
        </SignOutButton>
      </SignedIn>
    </div>
  );
}
