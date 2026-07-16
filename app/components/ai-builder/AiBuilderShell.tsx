import { ReactNode } from "react";

export default function AiBuilderShell({children}:{children:ReactNode}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="space-y-3 mb-10">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-400">AI Builder</p>
        <h1 className="text-5xl font-bold text-white">Build an AI that knows your business.</h1>
        <p className="text-neutral-400 max-w-3xl">
          Tell it everything you'd tell a new employee. We'll organize it into a reviewable AI knowledge base.
        </p>
      </div>
      {children}
    </main>
  );
}
