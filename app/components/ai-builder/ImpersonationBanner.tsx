"use client";

import { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { stopCustomerImpersonationAction } from "@/app/admin/actions";

export default function ImpersonationBanner() {
  const { actor, sessionId } = useAuth();
  const { signOut, setActive, client } = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!actor) return null;

  async function stop() {
    setPending(true);
    setError(null);
    try {
      await stopCustomerImpersonationAction();
      const adminSession = client?.sessions.find((candidate) => candidate.user?.id === actor?.sub && candidate.id !== sessionId);
      await signOut({ sessionId: sessionId ?? undefined });
      if (adminSession) {
        await setActive({ session: adminSession.id });
        window.location.assign("/admin");
      } else {
        window.location.assign("/admin");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impersonation could not be stopped.");
      setPending(false);
    }
  }

  return <div role="status" className="sticky top-[88px] z-40 mb-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-[#101936] px-4 py-3 text-center shadow-xl sm:flex-row sm:text-left"><div><p className="text-sm font-black text-amber-200">Customer impersonation is active</p><p className="mt-1 text-xs text-slate-300">Actions in AI Builder are being performed as this customer. Stop impersonating when finished.</p>{error&&<p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}</div><button type="button" disabled={pending} onClick={stop} className="shrink-0 rounded-lg border border-amber-300/30 bg-[#030713] px-4 py-2 text-xs font-black text-white hover:text-amber-200 disabled:opacity-50">{pending ? "Stopping…" : "Stop impersonating"}</button></div>;
}
