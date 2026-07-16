import {extractBusinessIntake} from "@/app/lib/ai-engine/intake";
import type {RuntimeDependencies} from "./contracts";
import type {IntakeExtractionRequest} from "@/app/lib/ai-engine/intake";

export async function processIntake(request:IntakeExtractionRequest,deps:RuntimeDependencies){
 return extractBusinessIntake({request,runModel:deps.runIntakeModel});
}
