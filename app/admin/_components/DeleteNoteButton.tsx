"use client";

import { useState, useTransition } from "react";
import { useCanonicalConfirm } from "@/app/components/ui/CanonicalConfirmDialog";
import type { AdminMutationResult } from "../actions";
import { revisionConflictMessage } from "./AdminMutationForm";

export default function DeleteNoteButton({ noteId, projectId, expectedRevision, action }: { noteId: string; projectId: string; expectedRevision: number; action: (data: FormData) => Promise<AdminMutationResult | void> }) {
  const [pending,startTransition]=useTransition(); const {showConfirm,confirmDialogNode}=useCanonicalConfirm();
  const [result,setResult]=useState<AdminMutationResult>();
  return <>{confirmDialogNode}<button type="button" disabled={pending} onClick={async()=>{if(!await showConfirm({title:"Delete internal note?",message:"This private note will be permanently removed.",confirmLabel:"Delete note"}))return;const data=new FormData();data.set("noteId",noteId);data.set("projectId",projectId);data.set("expectedRevision",String(expectedRevision));startTransition(()=>{void action(data).then(nextResult=>{if(nextResult)setResult(nextResult);});});}} className="cta-raised rounded-lg border border-red-400/20 bg-red-400/[.06] px-3 py-2 text-xs font-bold text-red-200 hover:border-red-300/40 disabled:opacity-50">{pending?"Deleting…":"Delete"}</button>{result?.ok===false&&<p role="alert" className="basis-full rounded-lg border border-amber-300/25 bg-amber-300/[.07] px-3 py-2 text-xs text-amber-100">{revisionConflictMessage}</p>}</>;
}
