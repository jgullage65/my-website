"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/lib/admin/auth";
import { createAdminNote, deleteAdminNote, PURCHASE_STAGES, updateAdminNote, updateAdminProject, updateAdminPurchase } from "@/app/lib/admin/repository";

const field = (data: FormData, name: string, max = 5000) => String(data.get(name) ?? "").trim().slice(0, max);
const optional = (data: FormData, name: string, max?: number) => field(data, name, max) || null;
const refreshProject = (projectId: string) => { revalidatePath(`/admin/projects/${projectId}`); revalidatePath("/admin/projects"); revalidatePath("/admin/users"); };

export async function saveProjectAction(data: FormData) {
  await requireAdmin();
  const projectId = field(data, "projectId", 200), businessName = field(data, "businessName", 160);
  if (!projectId || !businessName) return;
  await updateAdminProject(projectId, { businessName, ownerName: optional(data, "ownerName", 160),
    ownerEmail: optional(data, "ownerEmail", 320), website: optional(data, "website", 2000),
    internalStatus: optional(data, "internalStatus", 120), internalSummary: optional(data, "internalSummary", 5000) });
  refreshProject(projectId);
}

export async function createNoteAction(data: FormData) {
  await requireAdmin(); const projectId=field(data,"projectId",200), content=field(data,"content",10000);
  if (!projectId || !content) return; await createAdminNote(projectId,content); refreshProject(projectId);
}

export async function updateNoteAction(data: FormData) {
  await requireAdmin(); const projectId=field(data,"projectId",200),noteId=field(data,"noteId",200),content=field(data,"content",10000);
  if (!projectId || !noteId || !content) return; await updateAdminNote(noteId,projectId,content); refreshProject(projectId);
}

export async function deleteNoteAction(data: FormData) {
  await requireAdmin(); const projectId=field(data,"projectId",200),noteId=field(data,"noteId",200);
  if (!projectId || !noteId) return; await deleteAdminNote(noteId,projectId); refreshProject(projectId);
}

export async function savePurchaseAction(data: FormData) {
  await requireAdmin(); const purchaseId=field(data,"purchaseId",200),projectId=field(data,"projectId",200);
  const status=field(data,"status",80),followUpStage=field(data,"followUpStage",80);
  if (!purchaseId || !PURCHASE_STAGES.includes(status as typeof PURCHASE_STAGES[number]) || !PURCHASE_STAGES.includes(followUpStage as typeof PURCHASE_STAGES[number])) return;
  await updateAdminPurchase(purchaseId,{status,followUpStage,internalComments:optional(data,"internalComments",10000)});
  revalidatePath("/admin/purchases"); if(projectId) revalidatePath(`/admin/projects/${projectId}`);
}
