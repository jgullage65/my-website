"use client";

import { useState } from "react";
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

  return (
    <AiBuilderShell>
      {step==="welcome" && <AiBuilderWelcome onContinue={()=>setStep("form")} />}
      {step==="form" && (
        <AiBuilderForm
          value={builder}
          onChange={setBuilder}
          onBuild={()=>setStep("building")}
        />
      )}
      {step==="building" && <AiBuilderProgress builder={builder} />}
    </AiBuilderShell>
  );
}
