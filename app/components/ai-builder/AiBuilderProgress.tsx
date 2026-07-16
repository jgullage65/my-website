import type { BuilderState } from "./AiBuilderClient";

const steps=[
"Reading business...",
"Extracting facts...",
"Generating FAQs...",
"Checking conflicts...",
"Preparing review..."
];

export default function AiBuilderProgress({builder}:{builder:BuilderState}){
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{builder.businessName || "Your Business"}</h2>
        <p className="text-neutral-400">Building assistant: <strong>{builder.assistantName || "Assistant"}</strong></p>
      </div>
      {steps.map(step=>(
        <div key={step}>
          <div className="mb-2 text-white">{step}</div>
          <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-amber-500"/>
          </div>
        </div>
      ))}
    </div>
  );
}
