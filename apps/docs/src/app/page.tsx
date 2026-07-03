import * as React from "react";

export default function QuickstartPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Quickstart</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          From zero to a working SpatialRail in under 10 minutes.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">1. Install</h2>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="text-sm text-white/80"><code>npm install @glassbox/core @glassbox/react</code></pre>
        </div>
        <p className="text-sm text-white/50">Peer dependencies: React ≥ 19, React DOM ≥ 19</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">2. Wrap your app</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Add <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">ThoughtTreeProvider</code> at
          your application root. This initializes the DAG state manager and makes it available everywhere.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`import { ThoughtTreeProvider } from '@glassbox/react';

export function App() {
  return (
    <ThoughtTreeProvider>
      <YourApp />
    </ThoughtTreeProvider>
  );
}`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">3. Add the SpatialRail</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Place <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">SpatialRail</code> in your
          layout as a right-rail panel alongside your main content.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`import { SpatialRail } from '@glassbox/react';

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      <main className="flex-1 p-8">{children}</main>
      <aside className="w-96 shrink-0 border-l border-white/10 bg-[#0a0d14]">
        <SpatialRail />
      </aside>
    </div>
  );
}`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">4. Add nodes</h2>
        <p className="text-sm leading-relaxed text-white/70">
          Use the <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">useThoughtTree</code> hook
          to add nodes as your AI generates reasoning. Nodes appear in the SpatialRail automatically.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`import { useThoughtTree } from '@glassbox/react';

function AIComponent() {
  const { addNode } = useThoughtTree();

  async function handleResponse(response) {
    // Add a citation when the AI retrieves a source
    const { nodeId: citationId } = addNode({
      type: 'citation',
      source: { kind: 'url', uri: response.sourceUrl, title: response.sourceTitle },
      excerpt: response.sourceExcerpt,
    });

    // Add a decision grounded in that citation
    addNode({
      type: 'decision',
      claim: response.conclusion,
      confidence: response.confidence,  // 0.0 to 1.0
      provenance: [citationId],
      rationale: response.reasoning,
    });
  }
}`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">5. Gate agentic actions</h2>
        <p className="text-sm leading-relaxed text-white/70">
          When your AI is about to take an action, add an execution node. The rail pauses and renders
          Allow / Reject / Modify controls until the user responds.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`addNode({
  type: 'execution',
  action: {
    kind: 'API_CALL',
    summary: 'Send email to team@company.com',
    payload: { to: 'team@company.com', subject: '...', body: '...' },
    explanation: 'Sending the draft approved in step 3.',
  },
  gate: { status: 'pending' },
});`}</code></pre>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e0bc78]/20 bg-[#e0bc78]/5 p-8">
        <h2 className="text-xl font-semibold text-[#e0bc78] mb-3">What you just built</h2>
        <p className="text-sm text-white/70 leading-relaxed">
          Your app now has a persistent right-rail showing AI reasoning in real time. Citations, decisions,
          and gated actions render as typed nodes. Users can hover decisions to see which citations grounded them,
          fork the reasoning tree to explore alternatives, and explicitly approve or reject any action before it runs.
        </p>
        <div className="mt-4 flex gap-6 text-sm">
          <a href="/components/spatial-rail" className="text-[#e0bc78] hover:underline">SpatialRail props →</a>
          <a href="/architecture" className="text-[#e0bc78] hover:underline">Architecture →</a>
          <a href="/node-model" className="text-[#e0bc78] hover:underline">Node Model →</a>
        </div>
      </section>
    </main>
  );
}
