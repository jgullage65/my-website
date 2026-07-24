"use client";

import { useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";
import type { AdminMutationResult } from "../actions";

export const revisionConflictMessage = "This record was updated elsewhere. We refreshed it with the latest information; review it before saving again.";

export default function AdminMutationForm({ action, revision, className, children }: { action: (data: FormData) => Promise<AdminMutationResult | void>; revision: number; className?: string; children: ReactNode }) {
  const [result,setResult]=useState<AdminMutationResult>();
  const [,startTransition]=useTransition();
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>{void action(data).then(nextResult=>{if(nextResult)setResult(nextResult);});});};
  return <div>{result?.ok===false&&<p role="alert" className="mb-4 rounded-xl border border-amber-300/25 bg-amber-300/[.07] px-4 py-3 text-sm text-amber-100">{revisionConflictMessage}</p>}<form key={revision} onSubmit={submit} className={className}>{children}</form></div>;
}
