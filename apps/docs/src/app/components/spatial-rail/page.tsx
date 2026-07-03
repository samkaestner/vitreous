import * as React from "react";

export default function SpatialRailPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <p className="text-sm font-medium text-[#e0bc78] mb-3">Component</p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Spatial Rail</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          A persistent right-rail that renders AI reasoning as a scrollable, branching timeline of typed nodes.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">What it does</h2>
        <p className="text-base leading-relaxed text-white/70">
          The SpatialRail is the flagship component of Glassbox. It reads from the nearest
          <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">ThoughtTreeProvider</code>
          and renders the full DAG as a column-based layout: the active branch occupies the primary lane,
          inactive branches appear as dimmed parallel lanes, and animated SVG bezier connectors draw between fork points.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          Each node type renders differently. Citation nodes show source metadata. Decision nodes display
          confidence color-coding and reveal provenance links on hover. Execution nodes render as gated actions
          with Allow / Reject / Modify controls. Conflict nodes split into a Y-junction with side-by-side comparison.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Usage</h2>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`import { ThoughtTreeProvider, SpatialRail } from '@glassbox/react';

function App() {
  return (
    <ThoughtTreeProvider>
      <div className="flex min-h-screen">
        <main className="flex-1">{/* your app */}</main>
        <aside className="w-96 border-l border-white/10">
          <SpatialRail />
        </aside>
      </div>
    </ThoughtTreeProvider>
  );
}`}</code></pre>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Props</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Prop</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Default</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/70">
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-white/90">className</td>
                <td className="px-4 py-3 font-mono text-xs">string</td>
                <td className="px-4 py-3 text-white/40">—</td>
                <td className="px-4 py-3">Additional CSS classes applied to the rail container.</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-white/90">onNodeClick</td>
                <td className="px-4 py-3 font-mono text-xs">{"(nodeId: string) => void"}</td>
                <td className="px-4 py-3 text-white/40">—</td>
                <td className="px-4 py-3">Callback fired when any node is clicked.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Node visual reference</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ["Citation", "bg-white/5 border-white/20", "White card with source domain, optional favicon, and excerpt preview."],
            ["Decision", "bg-[#e0bc78]/10 border-[#e0bc78]/30", "Confidence-colored card. Cool tones = high confidence. Warm tones = low. Hover to highlight contributing citations."],
            ["Execution", "bg-emerald-500/10 border-emerald-500/30", "Gated card with Allow Once / Always Allow / Modify / Reject controls. Rail pauses until resolved."],
            ["Conflict", "bg-red-500/10 border-red-500/30", "Y-junction split. Side-by-side source comparison. Rail pauses until user arbitrates."],
          ].map(([type, cls, desc]) => (
            <div key={type} className={`rounded-xl border p-4 ${cls}`}>
              <p className="text-sm font-medium text-white mb-1">{type}</p>
              <p className="text-xs text-white/60 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Design notes</h2>
        <p className="text-base leading-relaxed text-white/70">
          The confidence color mapping (cool → warm) is driven by the <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">confidence</code> field
          on DecisionNodes (0.0–1.0). You can override the color scale via <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">@glassbox/theme</code> tokens.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          Branch lane widths, connector curve tension, and animation timing are all configurable via CSS
          custom properties on the rail container. See <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">@glassbox/theme</code> for the full token reference.
        </p>
      </section>
    </main>
  );
}
