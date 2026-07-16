"use client";
import {useState} from "react";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderWelcome from "./AiBuilderWelcome";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderProgress from "./AiBuilderProgress";

export default function AiBuilderClient(){
 const [step,setStep]=useState<"welcome"|"form"|"building">("welcome");
 return <AiBuilderShell>{
 step==="welcome"?<AiBuilderWelcome onContinue={()=>setStep("form")}/>:
 step==="form"?<AiBuilderForm onBuild={()=>setStep("building")}/>:
 <AiBuilderProgress/>
 }</AiBuilderShell>;
}
