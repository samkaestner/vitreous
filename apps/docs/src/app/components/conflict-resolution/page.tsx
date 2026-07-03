import * as React from "react";

export default function ConflictResolutionPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <p className="text-sm font-medium text-[#e0bc78] mb-3">Component</p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Conflict Resolution</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Surface contradictory sources as a Y-junction the user arbitrates before generation continues.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">The pattern</h2>
        <p className="text-base leading-relaxed text-white/70">
          During retrieval, AI systems regularly encounter sources that fundamentally disagree.
          The standard response is to synthesize silently — choosing one source, averaging the claims, or hallucinating
          a reconciliation. The Synthesis Clash pattern refuses this. When contradictory sources are detected,
          the reasoning chain halts and the user is forced to arbitrate.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          Visually, the SpatialRail splits into a Y-junction at the conflict node. Both contending sources are
          presented side-by-side. The user designates one as authoritative — collapsing the junction back into
          a single active branch — before the AI continues.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Adding a conflict node</h2>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`const { addNode, resolveConflict } = useThoughtTree();

// First, add the two conflicting citation nodes
const { nodeId: sourceA } = addNode({
  type: 'citation',
  source: { kind: 'url', uri: 'https://source-a.com', title: 'Source A' },
  excerpt: 'The regulation comes into effect January 1, 2025.',
});

const { nodeId: sourceB } = addNode({
  type: 'citation',
  source: { kind: 'url', uri: 'https://source-b.com', title: 'Source B' },
  excerpt: 'The regulation comes into effect March 15, 2025.',
});

// Then add the conflict node referencing both
const { nodeId: conflictId } = addNode({
  type: 'conflict',
  contenders: [sourceA, sourceB],
  description: 'Sources disagree on the regulation effective date.',
});`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Resolving the conflict</h2>
        <p className="text-sm leading-relaxed text-white/70">
          The SpatialRail renders Resolve controls automatically. To handle resolution programmatically:
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`// Called when user clicks "Resolve with Source A"
resolveConflict({
  nodeId: conflictId,
  chosenContenderId: sourceA,
  note: 'User selected Source A as authoritative.',
});

// The DAG state updates: conflict.resolution.chosen = sourceA
// The Y-junction collapses in the SpatialRail
// The active branch continues from sourceA`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Standalone widget</h2>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="text-sm text-white/80"><code>{`import { ConflictNodeUI } from '@glassbox/react';

<ConflictNodeUI nodeId={conflictNodeId} />`}</code></pre>
        </div>
        <p className="text-sm text-white/50">Renders the side-by-side comparison panel and resolution controls independently of the SpatialRail.</p>
      </section>
    </main>
  );
}
