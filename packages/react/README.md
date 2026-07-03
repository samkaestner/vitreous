# @vitreous/react

React UI components for AI transparency — the UI layer of the [Vitreous](https://github.com/samkaestner/vitreous) XAI framework.

Built on [`@vitreous/core`](https://www.npmjs.com/package/@vitreous/core), styled with Tailwind CSS, animated with Framer Motion.

## Install

```bash
npm install @vitreous/core @vitreous/react
```

**Peer dependencies:** React ≥ 19, React DOM ≥ 19

## Quick Start

```tsx
import { ThoughtTreeProvider, useThoughtTree, SpatialRail } from '@vitreous/react';

// 1. Wrap your app
function App() {
  return (
    <ThoughtTreeProvider>
      <Layout />
    </ThoughtTreeProvider>
  );
}

// 2. Add SpatialRail to your layout
function Layout() {
  return (
    <div style={{ display: 'flex' }}>
      <main>{/* your app content */}</main>
      <SpatialRail />
    </div>
  );
}

// 3. Add nodes from anywhere in your app
function MyAIComponent() {
  const { addNode } = useThoughtTree();

  async function handleAIResponse() {
    const { nodeId: citationId } = addNode({
      type: 'citation',
      source: { kind: 'url', uri: 'https://...', title: 'Source' },
    });

    addNode({
      type: 'decision',
      claim: 'The answer is X',
      confidence: 0.91,
      provenance: [citationId],
    });
  }
}
```

## Components

### `ThoughtTreeProvider`

Context provider that initializes the DAG state manager. Wrap your application root.

```tsx
<ThoughtTreeProvider initialState={optionalState}>
  {children}
</ThoughtTreeProvider>
```

### `useThoughtTree()`

Hook to access the thought tree API from any component.

```ts
const {
  state,               // ThoughtTreeState — full DAG snapshot
  addNode,             // Add a citation, decision, execution, or conflict node
  forkAtNode,          // Fork the tree at a decision node
  resolveConflict,     // Resolve a conflict node
  updateExecutionGate, // Update gate status (allow/reject/modify)
  switchBranch,        // Switch active branch
  getNode,             // Get a node by ID
  getActiveBranch,     // Get the current active branch
} = useThoughtTree();
```

### `SpatialRail`

The flagship component. Renders all branches as vertical lanes with animated SVG bezier connectors between fork points.

```tsx
<SpatialRail
  className?: string
  onNodeClick?: (nodeId: string) => void
/>
```

Each node type renders differently:
- **Citation** — white card with source domain/favicon
- **Decision** — confidence-colored card with provenance hover highlighting
- **Execution** — gated card with Allow Once / Always Allow / Reject / Modify controls
- **Conflict** — Y-junction with side-by-side source comparison

### `DecisionModal`

Two-stage modal opened when forking at a decision node. Stage 1: decision details + contributing citations. Stage 2: fork steering prompt with suggested alternatives.

### `ExecutionNodeUI`

Standalone gate control widget for execution nodes.

```tsx
<ExecutionNodeUI nodeId={executionNodeId} />
```

### `ConflictNodeUI`

Standalone conflict resolution widget. Shows contending citation pairs side-by-side.

```tsx
<ConflictNodeUI nodeId={conflictNodeId} />
```

## Theming

Vitreous uses `@vitreous/theme` for design tokens. Override via CSS custom properties or swap the Tailwind preset:

```ts
// tailwind.config.ts
import { vitreousTailwindPreset } from '@vitreous/theme/tailwind';

export default {
  presets: [vitreousTailwindPreset],
  // your overrides
};
```

## License

MIT © Sam Kaestner
