import * as React from "react";

export default function ConfidenceProvenancePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <p className="text-sm font-medium text-[#e0bc78] mb-3">Component</p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Confidence Provenance</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Hover a decision node to highlight exactly which citations grounded it.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">The pattern</h2>
        <p className="text-base leading-relaxed text-white/70">
          A confidence score without context is nearly useless. Knowing an AI is "87% confident" tells
          you nothing about whether that confidence is warranted. Confidence Provenance solves this by
          making the link between a decision and its sources interactive — hover a decision node and the
          contributing citations emphasize, while non-contributing nodes dim.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          This is built into the SpatialRail automatically for any DecisionNode that has a
          <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">provenance</code> array.
          No additional setup required.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">How provenance works</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Each DecisionNode carries a <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">provenance</code> array
          — an ordered list of CitationNode IDs that contributed to the decision. The SpatialRail uses
          this to draw the highlight relationship.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`// Add citations
const { nodeId: citA } = addNode({ type: 'citation', source: { kind: 'url', uri: '...', title: 'Report 2024' } });
const { nodeId: citB } = addNode({ type: 'citation', source: { kind: 'url', uri: '...', title: 'Study 2023' } });
const { nodeId: citC } = addNode({ type: 'citation', source: { kind: 'url', uri: '...', title: 'Unrelated Doc' } });

// Add a decision grounded in A and B (not C)
addNode({
  type: 'decision',
  claim: 'The intervention is effective based on two independent studies.',
  confidence: 0.91,
  provenance: [citA, citB],  // citC will dim on hover — it did not contribute
  rationale: 'Both Report 2024 and Study 2023 show statistically significant results.',
});

// On hover: citA and citB emphasize. citC dims.`}</code></pre>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Confidence color mapping</h2>
        <p className="text-base leading-relaxed text-white/70">
          Decision nodes are color-coded by confidence score. The default scale maps cool tones to high
          confidence and warm tones to low confidence — a deliberate choice to make uncertainty visually
          salient without requiring the user to read a number.
        </p>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            ["≥ 0.85", "bg-blue-500/40 border-blue-400/40", "High"],
            ["0.65–0.84", "bg-teal-500/40 border-teal-400/40", "Moderate"],
            ["0.45–0.64", "bg-yellow-500/40 border-yellow-400/40", "Low"],
            ["< 0.45", "bg-red-500/40 border-red-400/40", "Very low"],
          ].map(([range, cls, label]) => (
            <div key={range} className={`rounded-lg border p-3 text-center ${cls}`}>
              <p className="text-xs font-mono text-white/80">{range}</p>
              <p className="text-xs text-white/50 mt-1">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-white/50">Override via <code className="font-mono text-xs">@glassbox/theme</code> tokens.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Design notes</h2>
        <p className="text-base leading-relaxed text-white/70">
          The provenance highlight is intentionally asymmetric: contributing citations become more prominent,
          non-contributing citations fade. This directs attention without removing information — the user
          can still see that other sources exist, but the signal is clear about what mattered for this decision.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          For touch devices, tap a decision node to toggle the provenance highlight state persistently
          (rather than requiring hover).
        </p>
      </section>
    </main>
  );
}
