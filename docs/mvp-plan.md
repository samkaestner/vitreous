# Glass Box MVP Plan

This roadmap tracks the MVP build for the Glass Box AI UX Framework and serves as a shared reference for implementation progress.

## Progress Snapshot

- Week 1 (in progress): Core deterministic IDs, invariants/validation, and core action tests are complete.
- Week 1 integration update: `@glassbox/react` `ThoughtTreeProvider` now delegates mutations to the `@glassbox/core` state manager (single state transition source of truth).
- Week 1 regression coverage: Added React-level provider tests for add/fork/switch flows and provider-usage guardrails.
- Week 2 kickoff: Decision-hover provenance highlighting is live (contributing citation links and citation nodes are emphasized while non-contributors dim).

## Scope

MVP covers four core framework capabilities:

1. Spatial Rail (chain/fork visualization)
2. Confidence Provenance (decision-to-citation grounding)
3. Execution Guardrails (Allow Once / Always Allow / Modify-Reject)
4. Conflict Resolution (Y-junction + manual arbitration)

---

## Milestones

## Week 1: Core Engine + Stable Rail

- Finalize `@glassbox/core` DAG invariants and deterministic ID generation.
- Lock action semantics for:
  - `addNode`
  - `forkAtNode`
  - `switchBranch`
  - `resolveConflict`
  - `updateExecutionGate`
- Add unit tests for immutability and action correctness.
- Stabilize lane rendering:
  - active branch grows in-place
  - inactive branches stay spatially fixed
  - fork connectors remain accurate after interactions/layout changes

### Week 1 Acceptance Criteria

- Forking from any decision creates a valid branch every time.
- Switching branches never reorders branch lane positions.
- Core action tests pass reliably.

## Week 2: Trust UX (Provenance + Guardrails + Conflict)

- Implement decision provenance highlighting:
  - hover decision -> highlight only contributing citations.
- Implement Execution Gate interaction:
  - Allow Once
  - Always Allow
  - Modify/Reject
  - paused main flow until resolved
- Implement Conflict Resolution flow:
  - conflict node
  - side-by-side contradictory snippets
  - user chooses resolution, tree state updates

### Week 2 Acceptance Criteria

- Confidence score is visually grounded in source citations.
- Execution actions are blocked until explicit user decision.
- Conflict can be resolved and DAG state updates correctly.

## Week 3: DX + Docs + A11y + QA

- Finalize `@glassbox/react` public API ergonomics and examples.
- Build docs in `apps/docs`:
  - architecture overview
  - node model
  - forking model
  - guardrails and conflict guides
  - quickstart and API reference
- Accessibility hardening:
  - keyboard/focus flow for switch modal, fork action, and tooltips
  - touch-device fallback for hover interactions
- Add integration tests for key user journeys in playground/docs.

### Week 3 Acceptance Criteria

- New developer can implement rail + fork + switch from docs alone.
- Critical interaction paths pass accessibility checks.
- Docs and playground demonstrate all 4 components end-to-end.

---

## Prioritized Task Board

## P0 (Must-Have for MVP)

- [x] Core deterministic ID strategy (`@glassbox/core`)
- [x] Core invariants + validation (no invalid parent refs / broken branches)
- [x] Unit tests for all core state actions
- [x] Active chain + fork creation from decision hover action
- [x] Stable lane persistence during branch switching
- [x] Curved fork connectors with active/inactive styling
- [x] Decision confidence tooltip + citation links (`+X` expansion)
- [x] Execution Gate node and action controls
- [x] Conflict node and manual resolution state updates
- [x] Basic docs quickstart and API references

## P1 (Should-Have for MVP Quality)

- [ ] Provenance highlight animation between decision and citation links
- [x] Inline payload editor for Execution Gate "Modify"
- [x] Side-by-side conflict snippet comparison panel
- [ ] Keyboard and screen-reader polish for all controls
- [ ] Touch fallback for hover-only interactions
- [ ] End-to-end interaction tests for fork/switch/resolve/guardrail flows

## P2 (Post-MVP Enhancements)

- [ ] Session persistence + restore tooling
- [ ] Time-travel / revision history inspector
- [ ] Advanced branch naming and branch management UI
- [ ] Analytics hooks for confidence, fork frequency, and conflict rate
- [ ] Visual theming presets and token expansion

---

## Definition of Done (MVP)

- `@glassbox/core` provides deterministic, tested DAG state transitions.
- `@glassbox/react` supports:
  - active linear chain
  - explicit user-driven forking from decision nodes
  - stable multi-branch rendering with curved connectors
  - confidence provenance interaction
  - execution guardrail controls
  - conflict resolution flow
- `apps/docs` is sufficient for external developers to integrate the framework without chat support.

