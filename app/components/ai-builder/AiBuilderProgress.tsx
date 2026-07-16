const steps=[
    "Reading business...",
    "Extracting facts...",
    "Generating FAQs...",
    "Checking conflicts...",
    "Preparing review..."
    ];
    
    export default function AiBuilderProgress(){
    return(
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-5">
    {steps.map(step=>(
    <div key={step}>
    <div className="mb-2 text-white">{step}</div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
    <div className="h-full w-2/3 rounded-full bg-amber-500"/>
    </div>
    </div>
    ))}
    </div>
    );
    }
    