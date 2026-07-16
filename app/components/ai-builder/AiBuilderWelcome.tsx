export default function AiBuilderWelcome({onContinue}:{onContinue:()=>void}){
    return <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 space-y-6">
    <h2 className="text-3xl font-bold">Teach your AI like a new employee.</h2>
    <p className="text-neutral-400">No prompts. No prompt engineering. Just explain your business naturally.</p>
    <button onClick={onContinue} className="rounded-xl bg-amber-500 px-5 py-3 font-semibold text-black">Get Started</button>
    </div>;
    }
    