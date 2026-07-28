import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/app/lib/auth/clerk";
import { DEFAULT_MODEL_IDS,listAvailableModels,type ModelPurpose } from "@/app/lib/ai-engine/models/registry";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{await requireClerkUserId();const purpose=new URL(request.url).searchParams.get("purpose") as ModelPurpose;if(purpose!=="crawl"&&purpose!=="test-assistant")return NextResponse.json({ok:false,error:{code:"invalid_purpose"}},{status:400});return NextResponse.json({ok:true,models:listAvailableModels(purpose),defaultModelId:DEFAULT_MODEL_IDS[purpose]});}catch{return NextResponse.json({ok:false,error:{code:"authentication_required"}},{status:401});}}
