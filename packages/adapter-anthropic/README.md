# @vitreous/adapter-anthropic

Puts the Vitreous supervision substrate under a live Anthropic (Claude) tool-use loop. Retrievals become citation nodes, contradictory sources halt the loop for a human to arbitrate, state-changing tools stop at an approval gate before they run, and the final answer is a decision node grounded in the citations it actually relied on. Any chat app already using the Anthropic API gets an inspectable, steerable event log for free.

This package is the runtime glue between `@anthropic-ai/sdk` and `@vitreous/core`. It does not replace either — it drives a manual tool-use loop (the SDK's own tool runner auto-executes tools, which is incompatible with approval gates) and turns each turn into Vitreous events.

## Install

```sh
npm install @vitreous/adapter-anthropic @vitreous/core @anthropic-ai/sdk
```

`@anthropic-ai/sdk` is a peer dependency — bring your own version (`>=0.80 <1.0`, the range that has adaptive-thinking types) rather than picking up a second copy transitively.

## Usage

```ts
import Anthropic from "@anthropic-ai/sdk";
import { createVitreousRun } from "@vitreous/core";
import { createAnthropicAdapter, sourceTool, gatedTool } from "@vitreous/adapter-anthropic";

const run = createVitreousRun({ title: "Gran fondo training plan" });

const searchStudies = sourceTool({
  name: "search_studies",
  description: "Search training studies relevant to the question",
  inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  execute: async (input) => {
    // return one or more { uri, title?, excerpt?, kind? } results
    return await lookUpStudies(input);
  },
});

const saveTrainingPlan = gatedTool({
  name: "save_training_plan",
  description: "Persist the finalized training plan",
  inputSchema: { type: "object", properties: { plan: { type: "string" } }, required: ["plan"] },
  summary: (input) => `Save training plan: ${JSON.stringify(input)}`,
  execute: async (input) => await persistPlan(input),
});

const adapter = createAnthropicAdapter({
  client: new Anthropic(),
  run,
  tools: [searchStudies, saveTrainingPlan],
  onPause: (pause) => {
    if (pause.type === "conflict") {
      // present pause.contenders to a human, then:
      // adapter.resolveConflict(pause.conflictNodeId, chosenNodeId, note)
    }
    if (pause.type === "gate") {
      // present pause.action to a human, then:
      // adapter.resolveGate(pause.executionNodeId, { status: "allowed_once" })
    }
  },
});

const result = await adapter.ask("How should I train for a gran fondo?");
console.log(result.decision); // { claim, confidence, rationale, nodeId }
```

## Tool classifications

Every host tool is one of three kinds — the adapter dispatches on this, not on the tool's name or behavior:

- **`sourceTool`** — retrieves evidence. Each result the tool returns becomes a `source.added` event and gets a stable `[src-N]` reference the model is instructed to cite. The tool result sent back to Claude is a plain-text rendering of those references.
- **`gatedTool`** — changes state. Every call stops at an approval gate (an `action.requested` event) before `execute` runs, unless the tool name is already in the run's always-allowed set — and even then, the invocation still lands in the audit log as a fresh `action.requested`/`action.resolved` pair.
- **`plainTool`** — anything else. Executes immediately, no node recorded. Use it for read-only helpers that aren't evidence retrieval.

The adapter also injects two control tools the model can call directly: `flag_conflict` (halt for arbitration instead of silently picking a side between contradictory sources) and `record_decision` (close out the task with a claim, confidence, rationale, and the `[src-N]` provenance actually relied on).

## What lands in the event log

Everything that matters about a run is reconstructible from `run.events` — see `@vitreous/core`'s event log for the full node/event model. From this adapter specifically: `source.added` for every retrieved result (and for the initial user prompt, recorded as a `kind: "user"` citation), `conflict.detected`/`conflict.resolved` around every arbitrated contradiction, `action.requested`/`action.resolved` around every gated tool call, `decision.made` for the final grounded answer, and `run.completed`/`run.failed` for how the run ended.

`resolveGate` and `resolveConflict` are the two calls a host application makes back into the adapter — from a UI, a CLI prompt, or wherever a human sits in the loop. Both throw on an unknown node id, since that indicates a bug in the caller rather than a recoverable runtime condition.

See the repository root [README](../../README.md) for the substrate this adapter sits on top of, and [`examples/gran-fondo.ts`](./examples/gran-fondo.ts) for a headless recreation of the playground's flagship contradictory-evidence scenario, including a human arbitrating a conflict and a gate from the terminal.

## Example

`examples/gran-fondo.ts` is not part of the package build — run it directly with `tsx` (requires `ANTHROPIC_API_KEY` in the environment, since it makes real API calls):

```sh
npx tsx examples/gran-fondo.ts
```
