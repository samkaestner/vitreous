import * as React from "react";

export default function WhyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Why Glassbox</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          AI transparency is a UX problem, not just a technical one.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">The black box problem</h2>
        <p className="text-base leading-relaxed text-white/70">
          Most AI interfaces are designed around a simple pattern: you send a message, you get an answer.
          The reasoning that produced that answer — the sources retrieved, the inferences drawn, the decisions made — is invisible.
          Users are left to take the output on faith, with no way to inspect, question, or correct the process that generated it.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          This is fine for low-stakes queries. It breaks down the moment AI is doing anything consequential.
          When an agent is about to modify a database, when a decision is based on sources that contradict each other,
          when a confidence score of 0.61 is doing a lot of work — the lack of transparency becomes a real liability.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Why a chat log is not enough</h2>
        <p className="text-base leading-relaxed text-white/70">
          The linear chat metaphor borrows from messaging apps. It is familiar, which is why everyone uses it.
          But AI reasoning is not linear — it branches, it retrieves, it synthesizes from multiple sources simultaneously,
          and it sometimes halts when it hits a contradiction.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          Squashing that into a flat thread loses the structure that makes the reasoning trustworthy or not.
          A chat log can tell you what the AI said. It cannot show you why — or give you the ability to intervene
          at the moment that matters.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">The DAG model</h2>
        <p className="text-base leading-relaxed text-white/70">
          Glassbox models AI reasoning as a Directed Acyclic Graph — a structure that can represent branching,
          provenance, and alternative paths without losing history. When a user steers the AI in a different direction,
          the original branch does not disappear. It stays, dimmed, alongside the new one.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          This reflects something true about how good reasoning works: alternatives exist, uncertainty is real,
          and decisions have lineage worth preserving.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Four patterns, one framework</h2>
        <p className="text-base leading-relaxed text-white/70">
          Glassbox ships four components, each addressing a specific trust failure in current AI interfaces:
        </p>
        <div className="space-y-4 mt-4">
          <div className="rounded-2xl border border-white/10 bg-[#121722] p-6">
            <h3 className="text-lg font-medium text-[#e0bc78] mb-2">Spatial Rail</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Reasoning should not be invisible. The Spatial Rail renders AI decision-making as a scrollable,
              branching timeline — giving users a spatial canvas to inspect, navigate, and steer.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121722] p-6">
            <h3 className="text-lg font-medium text-[#e0bc78] mb-2">Confidence Provenance</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              A confidence score means nothing without context. Hover a decision and the citations
              that grounded it light up — so users can evaluate the basis of a claim, not just its certainty.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121722] p-6">
            <h3 className="text-lg font-medium text-[#e0bc78] mb-2">Execution Gate</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Agentic AI takes actions. Some of those actions are irreversible. The Execution Gate pauses
              the reasoning chain before any state-changing operation — giving users the explicit ability
              to allow, modify, or reject before anything happens.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#121722] p-6">
            <h3 className="text-lg font-medium text-[#e0bc78] mb-2">Conflict Resolution</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              When sources contradict each other, the worst thing an AI can do is pick one silently.
              The Synthesis Clash surfaces the contradiction as a Y-junction the user has to resolve —
              making the tension visible instead of papering over it.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">For design teams</h2>
        <p className="text-base leading-relaxed text-white/70">
          Glassbox is as much a pattern library as a component library. The four components represent a
          design framework for AI trust UX — patterns you can adapt, extend, or use as a baseline
          for your own design system.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          The visual language (node types, confidence color mapping, Y-junction geometry, gate states)
          is documented and intentional. It is a starting point, not a constraint.
          See the <a href="/node-model" className="text-[#e0bc78] hover:underline">Node Model</a> for the full visual vocabulary.
        </p>
      </section>
    </main>
  );
}
