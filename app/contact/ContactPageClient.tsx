"use client";

import { useSearchParams } from "next/navigation";
function normalizePreferred(raw: string) {
  const v = decodeURIComponent(raw || "").trim().toLowerCase();
  if (["text", "sms"].includes(v)) return "Text";
  if (["phone", "call"].includes(v)) return "Call";
  if (["email", "e-mail", "mail"].includes(v)) return "Email";
  return "Email";
}

function normalizeService(raw: string) {
  const v = (raw || "").trim().toLowerCase();

  if (["website", "web", "site"].includes(v)) return "Website Creation";
  if (["flyers", "