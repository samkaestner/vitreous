"use client";

import * as React from "react";
import Script from "next/script";

type MermaidWindow = Window & {
  mermaid?: {
    initialize: (config: { startOnLoad: boolean; theme: string }) => void;
    init: (config: unknown, nodes: NodeListOf<Element>) => void;
  };
};

export default function ArchitecturePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Branching Architecture
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          How the event log, DAG, lineage, and spatial rail work together without exposing raw chain-of-thought.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Immutability & The DAG</h2>
        <p className="text-base leading-relaxed text-white/70">
          In Vitreous, user-visible supervision state is an immutable Directed Acyclic Graph (DAG). 
          When a user corrects an AI mistake or decides to steer the assistant in a different direction, 
          <strong>history is never rewritten</strong>.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          Instead, modifying a decision creates a new <em>Fork</em> (a new Branch). This guarantees that the provenance of 
          any generated artifact can be traced back to its specific execution lineage. 
          If you make a mistake, the old branch still exists, and you can simply switch back to it.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Append-only Events</h2>
        <p className="text-base leading-relaxed text-white/70">
          Production apps record versioned <code className="font-mono text-[#e0bc78] bg-white/5 px-1.5 rounded text-sm">VitreousEvent</code> objects:
          source added, decision made, conflict detected, action requested, branch forked, branch switched,
          run completed, and run failed. Replaying those events rebuilds the same <code className="font-mono text-[#e0bc78] bg-white/5 px-1.5 rounded text-sm">ThoughtTreeState</code>.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          This keeps persistence simple. Teams can store the event log locally or in their own backend,
          then hydrate <code className="font-mono text-[#e0bc78] bg-white/5 px-1.5 rounded text-sm">&lt;VitreousProvider /&gt;</code>
          without adopting a hosted service.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Lineage Navigation</h2>
        <p className="text-base leading-relaxed text-white/70">
          A <code className="font-mono text-[#e0bc78] bg-white/5 px-1.5 rounded text-sm">Branch</code> is simply a pointer to a sequence of nodes. When a new branch is created via forking, 
          it inherits the exact lineage of the parent up to the fork point. 
        </p>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 overflow-hidden">
          <pre className="mermaid">
            {`graph TD
    A[Decision 1] --> B[Decision 2]
    B --> C[Decision 3]
    
    style A fill:#1a202c,stroke:#e0bc78,stroke-width:2px,color:#fff
    style B fill:#1a202c,stroke:#e0bc78,stroke-width:2px,color:#fff
    style C fill:#1a202c,stroke:#e0bc78,stroke-width:2px,color:#fff
    
    B -. Fork .-> D[Decision 2a]
    D --> E[Execution]
    
    style D fill:#1a202c,stroke:#38b2ac,stroke-width:2px,color:#fff
    style E fill:#1a202c,stroke:#38b2ac,stroke-width:2px,color:#fff
    
    classDef branchA stroke:#e0bc78,stroke-width:2px;
    classDef branchB stroke:#38b2ac,stroke-width:2px;`}
          </pre>
        </div>
        <p className="text-sm text-white/50 mt-2 text-center">
          Branch A (Gold) and Branch B (Teal). Branch B inherits Decision 1 from Branch A.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Spatial Rail Layout Algorithm</h2>
        <p className="text-base leading-relaxed text-white/70">
          Traditional DAG visualizers (like Git tree graphs) quickly become sprawling, chaotic, and impossible to read when dealing with dense text nodes. 
          The <code className="font-mono text-[#e0bc78] bg-white/5 px-1.5 rounded text-sm">&lt;SpatialRail /&gt;</code> solves this using a strict column-based layout:
        </p>
        <ul className="list-disc pl-5 space-y-3 text-white/70 leading-relaxed">
          <li><strong>The Active Lane:</strong> The currently selected branch always occupies the widest, most prominent lane. Its entire lineage is rendered linearly, top-to-bottom.</li>
          <li><strong>Inactive Lanes:</strong> Adjacent branches are pushed into dimmer, narrower columns. They act as &quot;ghosts&quot; of alternative realities.</li>
          <li><strong>Curved Connectors:</strong> SVG paths dynamically draw from the parent fork node in the inactive lane directly into the active lane, providing instant spatial grounding without tangled lines.</li>
        </ul>
        <p className="text-base leading-relaxed text-white/70">
          This layout algorithm entirely removes cognitive overload, allowing users to focus on the <em>current</em> reasoning chain while keeping alternatives just one click away.
        </p>
      </section>
      
      {/* Script to initialize mermaid on load */}
      <Script 
        src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js" 
        strategy="afterInteractive"
        onLoad={() => {
          const mermaid = (window as MermaidWindow).mermaid;
          if (mermaid) {
            mermaid.initialize({ startOnLoad: true, theme: "dark" });
            mermaid.init(undefined, document.querySelectorAll(".mermaid"));
          }
        }}
      />
    </main>
  );
}
