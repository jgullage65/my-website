"use client";

import { SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";

export const aiBuilderCornerCtaClassName =
  "cta-raised inline-flex min-h-[34px] items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111]";

type Props = {
  suppressSignOut?: boolean;
};

export default function AiBuilderAuthCta({ suppressSignOut = false }: Props) {
  return (
    <div className="absolute right-4 top-4 z-10 flex justify-end sm:right-6 lg:right-8">
      <SignedOut>
        <SignInButton mode="modal" forceRedirectUrl="/ai-builder">
          <button type="button" className={aiBuilderCornerCtaClassName}>
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      {!suppressSignOut ? (
        <SignedIn>
          <SignOutButton redirectUrl="/ai-builder">
            <button type="button" className={aiBuilderCornerCtaClassName}>
              Sign Out
            </button>
          </SignOutButton>
        </SignedIn>
      ) : null}
    </div>
  );
}
