// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createVitreousRun, type VitreousSerializedRun } from "@vitreous/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";
import { ApprovalGate } from "../supervision/ApprovalGate.js";
import { ConflictResolver } from "../supervision/ConflictResolver.js";
import { VitreousProvider, useVitreous } from "./VitreousContext.js";
import { createInMemoryVitreousPersistence } from "./persistence.js";

function VitreousProbe() {
  const vitreous = useVitreous();
  const thoughtTree = useThoughtTree();

  return (
    <div>
      <div data-testid="run-id">{vitreous.runId}</div>
      <div data-testid="event-count">{vitreous.events.length}</div>
      <div data-testid="timeline-size">{thoughtTree.getBranchTimeline().length}</div>
      <button
        type="button"
        onClick={() => {
          const source = vitreous.recordSource({
            source: {
              kind: "url",
              uri: "https://example.com/source",
              domain: "example.com"
            }
          });
          vitreous.recordDecision({
            claim: "Visible supervision decision",
            confidence: 0.87,
            provenance: [source.nodeId!]
          });
        }}
      >
        record decision
      </button>
    </div>
  );
}

function makeActionRun() {
  const run = createVitreousRun({ runId: "run-action" });
  const action = run.requestActionApproval({
    action: {
      kind: "tool.send",
      payload: { id: "message-1" },
      summary: "Send customer message",
      explanation: "The assistant wants to send a customer-visible reply."
    }
  });
  return { events: run.events, actionId: action.nodeId! };
}

function makeConflictRun() {
  const run = createVitreousRun({ runId: "run-conflict" });
  const first = run.recordSource({
    source: {
      kind: "file",
      uri: "file:///a.md",
      title: "a.md"
    },
    excerpt: "Use option A."
  });
  const second = run.recordSource({
    source: {
      kind: "file",
      uri: "file:///b.md",
      title: "b.md"
    },
    excerpt: "Use option B."
  });
  const conflict = run.recordConflict({
    contenders: [first.nodeId!, second.nodeId!],
    description: "The sources disagree."
  });
  return { events: run.events, conflictId: conflict.nodeId! };
}

describe("VitreousProvider", () => {
  it("exposes event-backed run APIs and persists snapshots", () => {
    const persistence = createInMemoryVitreousPersistence();

    render(
      <VitreousProvider runId="run-ui" persistence={persistence}>
        <VitreousProbe />
      </VitreousProvider>
    );

    expect(screen.getByTestId("run-id").textContent).toBe("run-ui");
    expect(screen.getByTestId("event-count").textContent).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "record decision" }));

    expect(screen.getByTestId("timeline-size").textContent).toBe("2");
    expect(screen.getByTestId("event-count").textContent).toBe("3");
    const saved = persistence.load("run-ui") as VitreousSerializedRun | null;
    expect(saved?.events).toHaveLength(3);
  });

  it("lets ApprovalGate call host callbacks before resolving the action event", async () => {
    const { events, actionId } = makeActionRun();
    const onApprove = vi.fn();

    render(
      <VitreousProvider initialEvents={events}>
        <ApprovalGate nodeId={actionId} onApprove={onApprove} />
      </VitreousProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("allowed once")).toBeTruthy();
  });

  it("lets ConflictResolver call host callbacks before recording resolution", async () => {
    const { events, conflictId } = makeConflictRun();
    const onResolve = vi.fn();

    render(
      <VitreousProvider initialEvents={events}>
        <ConflictResolver nodeId={conflictId} onResolve={onResolve} />
      </VitreousProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /a.md/ }));

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Resolved")).toBeTruthy();
  });
});
