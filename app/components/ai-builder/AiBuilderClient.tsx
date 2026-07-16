"use client";

import { useEffect, useState } from "react";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderWelcome from "./AiBuilderWelcome";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderProgress from "./AiBuilderProgress";

export type BuilderState={
  businessName:string;
  assistantName:string;
  tone:string;
  description:string;
};

const initial:BuilderState={
  businessName:"",
  assistantName:"",
  tone:"Professional",
  description:"",
};

export default function AiBuilderClient(){
  const [step,setStep]=useState<"welcome"|"form"|"building">("welcome");
  const [builder,setBuilder]=useState(initial);
  const [progress,setProgress]=useState(0);

  useEffect(()=>{
    if(step!=="building") return;
    setProgress(0);
    const id=setInterval(()=>{
      setProgress(p=>{
        if(p>=5){
          clearInterval(id);
          return 5;
        }
        return p+1;
      });
    },700);
    return ()=>clearInterval(id);
  },[step]);

  return (
    <AiBuilderShell>
      {step==="welcome" && <AiBuilderWelcome onContinue={()=>setStep("form")} />}
      {step==="form" && <AiBuilderForm value={builder} onChange={setBuilder} onBuild={()=>setStep("building")} />}
      {step==="building" && <AiBuilderProgress builder={builder} completedSteps={progress} />}
    </AiBuilderShell>
  );
}
