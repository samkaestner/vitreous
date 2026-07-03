// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ThoughtTreeState } from "@vitreous/core";
import { ThoughtTreeProvider, useThoughtTree } from "./ThoughtTreeContext.js";

function makeInitialState(): ThoughtTreeState {
  return {
    nodesById: {
      "node-citation-1": {
        id: "node-citation-1",
        type: "citation",
        createdAt: "2026-01-01T00:00:00.000Z",
        branchId: "branch-main",
        parents: [],
        source: {
          kind: "url",
          uri: "https://example.com/reference",
          domain: "example.com"
        }
      },
      "node-decision-1": {
        id: "node-decision-1",
        type: "decision",
        createdAt: "2026-01-01T00:01:00.000Z",
        branchId: "branch-main",
        parents: ["node-citation-1"],
        claim: "baseline",
        confidence: 0.72,
        provenance: ["node-citation-1"]
      }
    },
    edges: [{ from: "node-citation-1", to: "node-decision-1" }],
    branchesById: {
      "branch-main": {
        id: "branch-main",
        createdAt: "2026-01-01T00:00:00.000Z",
        timeline: ["node-citation-1", "node-decision-1"]
      }
    },
    rootBranchId: "branch-main",
    activeBranchId: "branch-main",
    revision: 2,
    updatedAt: "2026-01-01T00:01:00.000Z"
  };
}

function ThoughtTreeProbe() {
  const api = useThoughtTree();
  const activeBranch = api.state.branchesById[api.state.activeBranchId];

  return (
    <div>
      <div data-testid="active-branch">{api.state.activeBranchId}</div>
      <div data-testid="revision">{api.state.revision}</div>
      <div data-testid="timeline-size">{api.getBranchTimeline().length}</div>
      <div data-testid="steering-prompt">{activeBranch?.steering?.prompt ?? ""}</div>
      <div data-testid="steering-alt">{activeBranch?.steering?.selectedAlternativeId ?? ""}</div>

      <button
        type="button"
        onClick={() => {
          api.addNode({
            type: "citation",
            source: {
              kind: "url",
              uri: "https://example.com/extra",
              domain: "example.com"
            }
          });
        }}
      >
        add citation
      </button>

      <button
        type="button"
        onClick={() => {
          api.forkAtNode({
            nodeId: "node-decision-1"
          });
        }}
      >
        fork
      </button>

      <button
        type="button"
        onClick={() => {
          api.forkAtNode({
            nodeId: "node-decision-1",
            steering: {
              prompt: "Optimize for cost over lift.",
              selectedAlternativeId: "alt-1"
            }
          });
        }}
      >
        fork with steering
      </button>

      <button
        type="button"
        onClick={() => {
          api.switchBranch("branch-main");
        }}
      >
        switch main
      </button>
    </div>
  );
}

function BrokenConsumer() {
  useThoughtTree();
  return null;
}

describe("ThoughtTreeProvider", () => {
  it("throws helpful error when used outside provider", () => {
    expect(() => render(<BrokenConsumer />)).toThrow(
      "[Vitreous] useThoughtTree must be used within <ThoughtTreeProvider initialState={...}>."
    );
  });

  it("applies add/fork/switch mutations through context API", () => {
    render(
      <ThoughtTreeProvider initialState={makeInitialState()}>
        <ThoughtTreeProbe />
      </ThoughtTreeProvider>
    );

    expect(screen.getByTestId("active-branch").textContent).toBe("branch-main");
    expect(screen.getByTestId("revision").textContent).toBe("2");
    expect(screen.getByTestId("timeline-size").textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "add citation" }));
    expect(screen.getByTestId("timeline-size").textContent).toBe("3");
    expect(screen.getByTestId("revision").textContent).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: "fork" }));
    expect(screen.getByTestId("active-branch").textContent).toContain(
      "branch-"
    );
    expect(screen.getByTestId("revision").textContent).toBe("4");

    fireEvent.click(screen.getByRole("button", { name: "switch main" }));
    expect(screen.getByTestId("active-branch").textContent).toBe("branch-main");
    expect(screen.getByTestId("revision").textContent).toBe("5");
  });

  it("captures fork steering on the new branch", () => {
    render(
      <ThoughtTreeProvider initialState={makeInitialState()}>
        <ThoughtTreeProbe />
      </ThoughtTreeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "fork with steering" }));

    expect(screen.getByTestId("active-branch").textContent).toContain("branch-");
    expect(screen.getByTestId("steering-prompt").textContent).toBe(
      "Optimize for cost over lift."
    );
    expect(screen.getByTestId("steering-alt").textContent).toBe("alt-1");
  });
});

