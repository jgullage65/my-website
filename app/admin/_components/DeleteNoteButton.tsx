"use client";

import { useTransition } from "react";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";

export default function DeleteNoteButton({ noteId, projectId, action }: { noteId: string; projectId: string; action: (data: FormData) => Promise<void> }) {
  const [pending,startTransition]=useTransition(); const {showConfirm,confirmDialogNode}=useCanonicalConfirm();
  return <>{confirmDialogNode}<button type="button" disabled={pending} onClick={async()=>{if(!await showConfirm({title:"Delete internal note?",message:"This private note will be permanently removed.",confirmLabel:"Delete note"}))return;const data=new FormData();data.set("noteId",noteId);data.set("projectId",projectId);startTransition(()=>{void action(data);});}} className="cta-raised rounded-lg border border-red-400/20 bg-red-400/[.06] px-3 py-2 text-xs font-bold text-red-200 hover:border-red-300/40 disabled:opacity-50">{pending?"Deleting…":"Delete"}</button></>;
}
