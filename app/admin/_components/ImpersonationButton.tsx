"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import { startCustomerImpersonationAction } from "../actions";

export default function ImpersonationButton({ projectId, customer }: { projectId: string; customer: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isLoaded, signIn, setActive } = useSignIn();
  const { showConfirm, confirmDialogNode } = useCanonicalConfirm();

  async function start() {
    const confirmed = await showConfirm({
      title: `Impersonate ${customer}?`,
      message: `You are about to enter the AI Builder as ${customer}.\n\nAll actions taken will occur as this customer. You must explicitly stop impersonating when your support work is complete.`,
      confirmLabel: "Impersonate customer",
    });
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      const result = await startCustomerImpersonationAction(projectId);
      if (!result.ok) throw new Error(result.error);
      if (!isLoaded || !signIn || !setActive) throw new Error("Clerk is not ready to start impersonation.");
      const impersonated = await signIn.create({ strategy: "ticket", ticket: result.token });
      if (!impersonated.createdSessionId) throw new Error("Clerk did not create an impersonated session.");
      await setActive({ session: impersonated.createdSessionId });
      window.location.assign("/ai-builder");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impersonation could not be started.");
      setPending(false);
    }
  }

  return <>{confirmDialogNode}<div className="flex flex-col items-start gap-2"><button type="button" disabled={pending} onClick={start} className="cta-raised rounded-xl border border-amber-300/20 bg-[#101936] px-4 py-2.5 text-sm font-black text-white hover:border-amber-300/40 disabled:cursor-wait disabled:opacity-50">{pending ? "Starting…" : "Impersonate customer"}</button>{error&&<p role="alert" className="max-w-md text-xs text-red-300">{error}</p>}</div></>;
}
