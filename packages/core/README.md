# @glassbox/core

Pure TypeScript DAG state machine for AI thought trees. The state layer behind the [Glassbox](https://github.com/samkaestner/glass-box) XAI framework.

**Zero runtime dependencies. Framework-agnostic. Fully typed.**

## Install

```bash
npm install @glassbox/core
```

## What it does

Glassbox models AI reasoning as a Directed Acyclic Graph (DAG) — not a flat array of messages. `@glassbox/core` manages that graph: typed, immutable node creation, branch forking, conflict resolution, and execution gate state, all with deterministic IDs and strict validation.

Use it standalone if you want to build your own UI. Pair it with [`@glassbox/react`](https://www.npmjs.com/package/@glassbox/react) for ready-made components.

## Node Types

| Type | Purpose |
|---|---|
| `citation` | A retrieved source (URL, file, or memory) with optional excerpt |
| `decision` | An AI inference with confidence score and provenance links to citations |
| `execution` | A proposed agentic action, gated until the user allows/rejects/modifies |
| `conflict` | A Y-junction where retrieved sources contradict — awaiting user resolution |

## Usage

```ts
import {
  createThoughtTreeStateManager,
} from '@glassbox/core';

const manager = createThoughtTreeStateManager();

// Add a citation
const { state: s1, nodeId: citationId } = manager.addNode({
  type: 'citation',
  source: { kind: 'url', uri: 'https://example.com', title: 'Example Source' },
  excerpt: 'Relevant excerpt from the source.',
});

// Add a decision grounded in that citation
const { state: s2, nodeId: decisionId } = manager.addNode({
  type: 'decision',
  claim: 'Based on the source, X appears to be true.',
  confidence: 0.87,
  provenance: [citationId],
});

// Fork at the decision to explore an alternative
const { state: s3 } = manager.forkAtNode({
  nodeId: decisionId,
  steering: { prompt: 'What if X is false instead?' },
});
```

## API Reference

### State factory

```ts
createEmptyThoughtTreeState(): ThoughtTreeState
createThoughtTreeStateManager(options?: ManagerOptions): UseThoughtTreeAPI
```

### Pure state transitions

```ts
addNodeToThoughtTree(state, input: AddNodeInput): { state, nodeId }
forkThoughtTreeAtNode(state, input: ForkAtNodeInput): { state, branchId }
resolveConflictNode(state, input: ResolveConflictInput): { state }
updateExecutionGate(state, input: UpdateExecutionGateInput): { state }
switchThoughtTreeBranch(state, branchId: BranchId): { state }
validateThoughtTreeState(state): ValidationResult
```

### Utilities

```ts
createDeterministicIdFactory(seed?): ThoughtTreeIdFactory
listNodeIdsByType(state, type: ThoughtNodeType): NodeId[]
```

## Types

All types are exported from `@glassbox/core`:

- `ThoughtNode`, `CitationNode`, `DecisionNode`, `ExecutionNode`, `ConflictNode`
- `ThoughtTreeState`, `BranchMeta`, `ThoughtEdge`
- `AddNodeInput`, `ForkAtNodeInput`, `ResolveConflictInput`, `UpdateExecutionGateInput`
- `NodeId`, `BranchId`, `ExecutionGateStatus`, `Provenance`

## License

MIT © Sam Kaestner
