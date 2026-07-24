"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/lib/admin/auth";
import { AdminRevisionConflictError, createAdminNote, deleteAdminNote, PURCHASE_STAGES, updateAdminNote, updateAdminProject, updateAdminPurchase } from "@/app/lib/admin/repository";
import { beginCustomerImpersonation, recordCustomerImpersonationStopped } from "@/app/lib/admin/impersonation";

const field = (data: FormData, name: string, max = 5000) => String(data.get(name) ?? "").trim().slice(0, max);
const optional = (data: FormData, name: string, max?: number) => field(data, name, max) || null;
const refreshProject = (projectId: string) => { revalidatePath(`/admin/projects/${projectId}`); revalidatePath("/admin/projects"); revalidatePath("/admin/users"); };
const revision = (data: FormData) => { const raw=data.get("expectedRevision"); if(raw===null) return null; const value=Number(raw); return Number.isSafeInteger(value)&&value>=0 ? value : null; };
const refreshConflict = (error: unknown, projectId: string) => { if(!(error instanceof AdminRevisionConflictError)) return false; refreshProject(projectId); revalidatePath("/admin/purchases"); return true; };
export type AdminMutationResult = { ok: true } | { ok: false; reason: "revision_conflict" };
const revisionConflictResult = { ok: false, reason: "revision_conflict" } as const;

export async function saveProjectAction(data: FormData) {
  await requireAdmin();
  const projectId = field(data, "projectId", 200), businessName = field(data, "businessName", 160);
  const expectedRevision=revision(data); if (!projectId || !businessName || expectedRevision===null) return;
  try { await updateAdminProject(projectId, { businessName, ownerName: optional(data, "ownerName", 160),
    ownerEmail: optional(data, "ownerEmail", 320), website: optional(data, "website", 2000),
    internalStatus: optional(data, "internalStatus", 120), internalSummary: optional(data, "internalSummary", 5000), expectedRevision }); } catch(error) { if(!refreshConflict(error,projectId)) throw error; return revisionConflictResult; }
  refreshProject(projectId);
  return { ok: true } as const;
}

export async function createNoteAction(data: FormData) {
  await requireAdmin(); const projectId=field(data,"projectId",200), content=field(data,"content",10000);
  if (!projectId || !content) return; await createAdminNote(projectId,content); refreshProject(projectId);
}

export async function updateNoteAction(data: FormData) {
  await requireAdmin(); const projectId=field(data,"projectId",200),noteId=field(data,"noteId",200),content=field(data,"content",10000);
  const expectedRevision=revision(data); if (!projectId || !noteId || !content || expectedRevision===null) return; try { await updateAdminNote(noteId,projectId,content,expectedRevision); } catch(error) { if(!refreshConflict(error,projectId)) throw error; return revisionConflictResult; } refreshProject(projectId); return { ok: true } as const;
}

export async function deleteNoteAction(data: FormData) {
  await requireAdmin(); const projectId=field(data,"projectId",200),noteId=field(data,"noteId",200);
  const expectedRevision=revision(data); if (!projectId || !noteId || expectedRevision===null) return; try { await deleteAdminNote(noteId,projectId,expectedRevision); } catch(error) { if(!refreshConflict(error,projectId)) throw error; return revisionConflictResult; } refreshProject(projectId); return { ok: true } as const;
}

export async function savePurchaseAction(data: FormData) {
  await requireAdmin(); const purchaseId=field(data,"purchaseId",200),projectId=field(data,"projectId",200);
  const status=field(data,"status",80),followUpStage=field(data,"followUpStage",80);
  const expectedRevision=revision(data); if (!purchaseId || expectedRevision===null || !PURCHASE_STAGES.includes(status as typeof PURCHASE_STAGES[number]) || !PURCHASE_STAGES.includes(followUpStage as typeof PURCHASE_STAGES[number])) return;
  try { await updateAdminPurchase(purchaseId,{status,followUpStage,internalComments:optional(data,"internalComments",10000),expectedRevision}); } catch(error) { if(!refreshConflict(error,projectId)) throw error; return revisionConflictResult; }
  revalidatePath("/admin/purchases"); if(projectId) revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true } as const;
}

export async function startCustomerImpersonationAction(projectIdInput: string) {
  const projectId = String(projectIdInput ?? "").trim().slice(0, 200);
  if (!projectId) return { ok: false as const, error: "A project is required for impersonation." };
  try {
    const result = await beginCustomerImpersonation(projectId);
    return { ok: true as const, token: result.token };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Impersonation could not be started." };
  }
}

export async function stopCustomerImpersonationAction() {
  await recordCustomerImpersonationStopped();
}
