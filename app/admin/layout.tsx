import type { ReactNode } from "react";
import { requireAdmin } from "@/app/lib/admin/auth";
import AdminNav from "./_components/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="admin-console min-h-screen bg-[#020611]/55">
    <div className="mx-auto grid min-h-screen max-w-[100rem] lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-amber-300/15 bg-[#030713]/85 p-4 backdrop-blur-xl sm:p-5 lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:border-b-0 lg:border-r">
        <div className="mb-5 flex items-center gap-3 px-2 lg:mb-8"><span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-300/35 bg-[linear-gradient(145deg,#101a43,#050b1d)] font-black text-amber-300 shadow-[0_10px_26px_rgba(0,0,0,.34),inset_0_1px_0_rgba(255,255,255,.06)]">AI</span><div><p className="text-sm font-black text-white">Builder Console</p><p className="text-[9px] font-bold uppercase tracking-[.2em] text-amber-200/45">Private operations</p></div></div>
        <AdminNav />
        <div className="mt-8 hidden rounded-2xl border border-amber-300/15 bg-amber-300/[.035] p-4 lg:block"><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300/70">Live workspace</p><p className="mt-2 text-xs leading-5 text-slate-500">Builder usage, customer progress, and sales intent in one place.</p></div>
      </aside>
      <main className="min-w-0 p-4 sm:p-7 lg:p-9 xl:p-10"><div className="mx-auto w-full max-w-[86rem]">{children}</div></main>
    </div>
  </div>;
}
