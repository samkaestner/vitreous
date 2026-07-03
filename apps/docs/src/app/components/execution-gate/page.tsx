import * as React from "react";

export default function ExecutionGatePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <p className="text-sm font-medium text-[#e0bc78] mb-3">Component</p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Execution Gate</h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Block agentic actions until the user explicitly allows, modifies, or rejects them.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">The pattern</h2>
        <p className="text-base leading-relaxed text-white/70">
          When an AI agent determines that an action is necessary — calling an API, mutating a database,
          sending a message — it should not execute silently. The Execution Gate translates the security
          patterns used in developer coding agents (Allow Once, Always Allow, Reject) into accessible UI
          controls your end-users can actually operate.
        </p>
        <p className="text-base leading-relaxed text-white/70">
          When an execution node is added with <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">gate.status: "pending"</code>,
          the SpatialRail renders it as a blocked gate and pauses the visible reasoning chain until the user resolves it.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Gate states</h2>
        <div className="space-y-4">
          {[
            ["pending", "bg-yellow-500/10 border-yellow-500/20", "The action is waiting for user decision. Rail is visually paused."],
            ["allowed_once", "bg-emerald-500/10 border-emerald-500/20", "User approved this specific instance. Future occurrences of the same action will prompt again."],
            ["always_allowed", "bg-emerald-500/10 border-emerald-500/20", "User whitelisted this action type for the session. Subsequent identical actions execute without prompting."],
            ["rejected", "bg-red-500/10 border-red-500/20", "User rejected the action. The node is marked rejected and the agent proceeds without executing."],
          ].map(([status, cls, desc]) => (
            <div key={status} className={`rounded-xl border p-4 ${cls}`}>
              <code className="text-sm font-mono text-white">{status}</code>
              <p className="mt-1 text-sm text-white/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Adding an execution node</h2>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`const { addNode, updateExecutionGate } = useThoughtTree();

// Add the execution node — renders as a pending gate in the rail
const { nodeId } = addNode({
  type: 'execution',
  action: {
    kind: 'MUTATE_DB',
    summary: 'Update user record #4821',
    payload: { userId: 4821, field: 'email', value: 'new@email.com' },
    explanation: 'Applying the email change you requested in step 2.',
  },
  gate: { status: 'pending' },
});

// Later — called by your gate resolution handler
// (the SpatialRail's built-in controls call this for you)
updateExecutionGate({
  nodeId,
  status: 'allowed_once',
  decidedBy: 'user',
});`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Wiring gate decisions to real actions</h2>
        <p className="text-sm leading-relaxed text-white/70">
          The SpatialRail renders the Allow / Reject / Modify controls automatically for pending execution nodes.
          To run your actual action when the user approves, subscribe to state changes:
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="overflow-x-auto text-sm leading-relaxed text-white/80"><code>{`const { state } = useThoughtTree();

useEffect(() => {
  const executionNodes = Object.values(state.nodesById)
    .filter(n => n.type === 'execution');

  for (const node of executionNodes) {
    if (node.gate.status === 'allowed_once' || node.gate.status === 'always_allowed') {
      // Execute the action
      runAction(node.action.payload);
    }
  }
}, [state]);`}</code></pre>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Standalone widget</h2>
        <p className="text-sm leading-relaxed text-white/70">
          You can also render the gate controls outside the SpatialRail using <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">ExecutionNodeUI</code> directly:
        </p>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-[#121722] p-5">
          <pre className="text-sm text-white/80"><code>{`import { ExecutionNodeUI } from '@glassbox/react';

<ExecutionNodeUI nodeId={executionNodeId} />`}</code></pre>
        </div>
      </section>
    </main>
  );
}
