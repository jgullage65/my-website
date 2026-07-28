"use client";

import { SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export const aiBuilderCornerCtaClassName =
  "cta-raised inline-flex min-h-[34px] items-center justify-center rounded-lg border border-amber-300/15 bg-[#080808] px-4 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-[#111111]";

export default function AiBuilderAuthCta() {
  const [hasNoProjects, setHasNoProjects] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ai-builder/projects", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && payload.ok && Array.isArray(payload.projects)) {
          setHasNoProjects(payload.projects.length === 0);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {hasNoProjects ? (
        <>
          <style>{`.ai-builder-no-projects ~ a[href="/ai-builder"] { display: none !important; }`}</style>
          <div className="ai-builder-no-projects absolute left-4 top-4 z-10 sm:left-6 lg:left-8">
            <SignedIn>
              <SignOutButton redirectUrl="/ai-builder">
                <button type="button" className={aiBuilderCornerCtaClassName}>
                  Sign out
                </button>
              </SignOutButton>
            </SignedIn>
          </div>
        </>
      ) : null}

      <div className="absolute right-4 top-4 z-10 flex justify-end sm:right-6 lg:right-8">
        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl="/ai-builder">
            <button type="button" className={aiBuilderCornerCtaClassName}>
              Sign In
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </>
  );
}
