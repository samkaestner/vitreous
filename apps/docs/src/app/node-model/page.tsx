import * as React from "react";

export default function NodeModelPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-8 sm:py-24 space-y-16">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          The Node Model
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/60">
          Understanding the supervision nodes that rebuild from the append-only <code className="font-mono text-[#e0bc78]">VitreousEvent</code> log.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Overview</h2>
        <p className="text-base leading-relaxed text-white/70">
          Vitreous uses a directed acyclic graph (DAG) to represent safe, user-facing
          supervision state: evidence, decisions, action gates, conflicts, and branches.
          It does not expose raw chain-of-thought. The graph is rebuilt from versioned
          events so host apps can persist, replay, and audit user-visible AI behavior.
        </p>
      </section>

      <div className="space-y-12">
        {/* Citation Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">CitationNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            Represents retrieved evidence, user context, memory, or other grounding
            material. Decisions reference these nodes through the <code className="font-mono text-xs text-white/90">provenance</code> array so users can inspect why a claim was made.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type CitationNode = {
  id: string;
  type: "citation";
  source: {
    uri: string;
    domain?: string;
    title?: string;
  };
  excerpt?: string;
}`}</code>
            </pre>
          </div>
        </section>

        {/* Decision Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e0bc78]/20 text-[#e0bc78] ring-1 ring-[#e0bc78]/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">DecisionNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            Represents a user-visible claim or recommendation made by the AI. This is
            the most common node in the rail. It surfaces safe summary copy,
            confidence, rationale, and cited provenance. Users can fork from a
            DecisionNode to steer the AI down an alternative path.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type DecisionNode = {
  id: string;
  type: "decision";
  claim: string;
  rationale?: string;
  confidence: number; // 0.0 to 1.0
  provenance: string[]; // Array of CitationNode IDs
  alternatives?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}`}</code>
            </pre>
          </div>
        </section>

        {/* Execution Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">ExecutionNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            Represents an external tool call, API request, or mutation. Execution
            Nodes are human-in-the-loop gates: the host app can pause until a user
            allows, rejects, or modifies the action.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type ExecutionNode = {
  id: string;
  type: "execution";
  action: {
    kind: string; // e.g. "MUTATE", "API_CALL", etc.
    summary: string;
    payload: unknown;
    explanation?: string;
  };
  gate: {
    status: "pending" | "allowed_once" | "always_allowed" | "rejected";
    decidedAt?: string;
    decidedBy?: "user" | "system";
    reason?: string;
  };
}`}</code>
            </pre>
          </div>
        </section>

        {/* Conflict Node */}
        <section className="rounded-2xl border border-white/10 bg-[#121722] p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className="text-xl font-medium text-white">ConflictNode</h3>
          </div>
          <p className="text-sm leading-relaxed text-white/70 mb-4">
            When evidence disagrees, the host app can record a ConflictNode instead of
            forcing a false synthesis. The user can arbitrate between contenders
            before the assistant continues.
          </p>
          <div className="rounded-lg bg-black/40 p-4 border border-white/5 overflow-x-auto">
            <pre className="text-xs text-white/60">
              <code>{`type ConflictNode = {
  id: string;
  type: "conflict";
  contenders: string[];
  description?: string;
  resolution?: {
    chosen: string;
    resolvedAt: string;
    note?: string;
  };
}`}</code>
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
