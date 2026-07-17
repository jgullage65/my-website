import { NextResponse } from "next/server";
import type { ConversationMemory } from "@/app/lib/ai-engine/contracts";
import { runOpenAiIntakeModel } from "@/app/lib/ai-engine/providers";
import { runEngine } from "@/app/lib/ai-engine/runtime";
import { persistAiBuilderProject } from "@/app/lib/db/ai-builder-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserKnowledgeRequest = {
  productsServices?: unknown;
  idealCustomers?: unknown;
  additionalKnowledge?: unknown;
};

type WebsiteKnowledgeRequest = {
  businessName?: unknown;