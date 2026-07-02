import * as React from "react";

const codeClass =
  "rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-white/88";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-24">
      <header className="max-w-3xl">
        <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
          Vitreous SDK
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          End-user supervision for production AI apps.
        </h1>
        <p className="mt-5 text-lg leading-8 text-white/64">
          Instrument an AI workflow once, then render provenance, decisions,
          conflicts, approval gates, branches, and audit history anywhere in
          your product. Vitreous exposes safe supervision summaries, not raw
          chain-of-thought.
        </p>
      </header>

      <section className="mt-14 grid gap-3 sm:grid-cols-3">
        {[
          ["Evidence", "Show the sources and context behind an answer."],
          ["Control", "Pause risky tool calls until a user approves them."],
          ["Reversibility", "Fork, steer, and switch branches without rewriting history."]
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-5"
          >
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/56">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-18">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Add Vitreous in 15 minutes
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
              Start with the React provider and the rail. Persistence is local
              by default here, but the adapter interface is intentionally small
              so teams can wire Postgres, Supabase, Redis, or their own backend.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[1rem] border border-white/12 bg-[#111318] p-6">
          <pre className="overflow-x-auto text-sm leading-6 text-white/78">
            <code>{`import {
  VitreousProvider,
  SpatialRail,
  createLocalStorageVitreousPersistence
} from "@vitreous/react";

const persistence = createLocalStorageVitreousPersistence("my-app:vitreous");

export function App() {
  return (
    <VitreousProvider runId="customer-session-42" persistence={persistence}>
      <main>{/* your AI product UI */}</main>
      <aside>
        <SpatialRail />
      </aside>
    </VitreousProvider>
  );
}`}</code>
          </pre>
        </div>
      </section>

      <section className="mt-18 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Instrument the workflow
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Vitreous records an append-only event log and rebuilds the DAG from
            that log. Your app can keep using normal model and tool APIs; it
            just records supervision events at the moments users care about.
          </p>
          <div className="mt-5 space-y-3 text-sm text-white/68">
            <p>
              Use <code className={codeClass}>recordSource</code> when retrieval
              adds evidence.
            </p>
            <p>
              Use <code className={codeClass}>recordDecision</code> when the AI
              makes a user-visible claim.
            </p>
            <p>
              Use <code className={codeClass}>recordConflict</code> instead of
              smoothing over contradictions.
            </p>
            <p>
              Use <code className={codeClass}>requestActionApproval</code> before
              a tool mutates the outside world.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1rem] border border-white/12 bg-[#111318] p-6">
          <pre className="overflow-x-auto text-sm leading-6 text-white/78">
            <code>{`const vitreous = useVitreous();

const source = vitreous.recordSource({
  source: {
    kind: "url",
    uri: "https://example.com/policy",
    domain: "example.com"
  },
  excerpt: "Refunds require manager approval."
});

const decision = vitreous.recordDecision({
  claim: "This refund needs approval.",
  confidence: 0.86,
  provenance: [source.nodeId]
});

vitreous.requestActionApproval({
  action: {
    kind: "refund.create",
    payload: { orderId, amount },
    summary: "Create customer refund",
    explanation: "This changes billing state."
  }
});`}</code>
          </pre>
        </div>
      </section>

      <section className="mt-18">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Use composable supervision primitives
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
          The rail is the flagship surface, but product teams can also place
          smaller controls where they already have user attention.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["SpatialRail", "Branching audit trail with active and inactive reasoning lanes."],
            ["ApprovalGate", "Callback-driven approval UI for tool calls and mutations."],
            ["ConflictResolver", "Human arbitration UI for contradictory evidence."]
          ].map(([name, description]) => (
            <div
              key={name}
              className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-5"
            >
              <code className="font-mono text-sm text-white/86">&lt;{name} /&gt;</code>
              <p className="mt-3 text-sm leading-6 text-white/56">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-18 rounded-[1rem] border border-white/10 bg-white/[0.035] p-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Production defaults
        </h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <p className="text-sm leading-6 text-white/60">
            <strong className="text-white/86">Replayable:</strong> every run is
            represented by versioned <code className={codeClass}>VitreousEvent</code>
            records that can rebuild <code className={codeClass}>ThoughtTreeState</code>.
          </p>
          <p className="text-sm leading-6 text-white/60">
            <strong className="text-white/86">Private by design:</strong>{" "}
            <code className={codeClass}>redactEvent</code>,{" "}
            <code className={codeClass}>shouldExposeNode</code>, and{" "}
            <code className={codeClass}>summarizeForUser</code> hooks keep raw
            provider traces out of end-user surfaces.
          </p>
          <p className="text-sm leading-6 text-white/60">
            <strong className="text-white/86">Self-hostable:</strong> the OSS v1
            runs locally and saves through a pluggable persistence adapter.
          </p>
          <p className="text-sm leading-6 text-white/60">
            <strong className="text-white/86">React-first:</strong> the initial
            UI SDK targets production React apps while the core event model stays
            framework-agnostic.
          </p>
        </div>
      </section>
    </main>
  );
}
