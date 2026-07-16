"use client";

import { useState } from "react";
import AiBuilderShell from "./AiBuilderShell";
import AiBuilderForm from "./AiBuilderForm";
import AiBuilderProgress from "./AiBuilderProgress";

export default function AiBuilderClient() {
  const [building,setBuilding]=useState(false);

  return (
    <AiBuilderShell>
      {building ? (
        <AiBuilderProgress />
      ) : (
        <AiBuilderForm onBuild={()=>setBuilding(true)} />
      )}
    </AiBuilderShell>
  );
}
