// @vitest-environment jsdom

import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CitationNode, DecisionNode } from "@vitreous/core";
import { DecisionModal } from "./DecisionModal.js";

function makeDecision(overrides?: Partial<DecisionNode>): DecisionNode {
  return {
    id: "node-decision-1",
    type: "decision",
    createdAt: "2026-01-01T00:00:00.000Z",
    branchId: "branch-main",
    parents: [],
    claim: "Ship variant A",
    confidence: 0.74,
    provenance: ["node-citation-1"],
    rationale: "Variant A maximizes lift while staying within the budget cap.",
    alternatives: [
      {
        id: "alt-1",
        label: "Optimize for cost over lift",
        description: "Re-rank candidates assuming the budget cap drops by 30%."
      },
      {
        id: "alt-2",
        label: "Defer until validated",
        description: "Hold the decision until a second source agrees."
      }
    ],
    ...overrides
  };
}

function makeCitation(): CitationNode {
  return {
    id: "node-citation-1",
    type: "citation",
    createdAt: "2026-01-01T00:00:00.000Z",
    branchId: "branch-main",
    parents: [],
    source: {
      kind: "url",
      uri: "https://example.com/report",
      title: "Reference Report",
      domain: "example.com"
    },
    excerpt: "Evidence supporting the lift estimate."
  };
}

describe("DecisionModal", () => {
  it("renders rationale and provenance in the details stage", () => {
    render(
      <DecisionModal
        open
        decision={makeDecision()}
        citations={[makeCitation()]}
        onClose={vi.fn()}
        onConfirmFork={vi.fn()}
      />
    );

    expect(screen.getByText("Decision details")).toBeTruthy();
    expect(
      screen.getByText("Variant A maximizes lift while staying within the budget cap.")
    ).toBeTruthy();
    const link = screen.getByRole("link", { name: /Reference Report/ });
    expect(link.getAttribute("href")).toBe("https://example.com/report");
  });

  it("falls back when rationale is missing", () => {
    render(
      <DecisionModal
        open
        decision={makeDecision({ rationale: undefined })}
        citations={[]}
        onClose={vi.fn()}
        onConfirmFork={vi.fn()}
      />
    );

    expect(screen.getByText("No rationale provided for this decision.")).toBeTruthy();
    expect(screen.getByText("No citations were attached to this decision.")).toBeTruthy();
  });

  it("advances from details to steering stage on 'Fork from here'", () => {
    render(
      <DecisionModal
        open
        decision={makeDecision()}
        citations={[makeCitation()]}
        onClose={vi.fn()}
        onConfirmFork={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Fork from here" }));

    expect(screen.getByText("Fork with steering")).toBeTruthy();
    expect(screen.getByLabelText("Steer the LLM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm fork" })).toBeTruthy();
  });

  it("submits empty steering when textarea is blank and no alternative selected", () => {
    const onConfirmFork = vi.fn();
    render(
      <DecisionModal
        open
        initialStage="steer"
        decision={makeDecision()}
        citations={[]}
        onClose={vi.fn()}
        onConfirmFork={onConfirmFork}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm fork" }));

    expect(onConfirmFork).toHaveBeenCalledTimes(1);
    expect(onConfirmFork).toHaveBeenCalledWith({});
  });

  it("submits trimmed prompt and selected alternative id", () => {
    const onConfirmFork = vi.fn();
    render(
      <DecisionModal
        open
        initialStage="steer"
        decision={makeDecision()}
        citations={[]}
        onClose={vi.fn()}
        onConfirmFork={onConfirmFork}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Optimize for cost over lift/ })
    );

    const textarea = screen.getByLabelText("Steer the LLM") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Re-rank candidates assuming the budget cap drops by 30%.");

    fireEvent.change(textarea, { target: { value: "  Be more aggressive on cost.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm fork" }));

    expect(onConfirmFork).toHaveBeenCalledWith({
      prompt: "Be more aggressive on cost.",
      selectedAlternativeId: "alt-1"
    });
  });

  it("toggling the same alternative clears its id but preserves the prefilled prompt", () => {
    const onConfirmFork = vi.fn();
    render(
      <DecisionModal
        open
        initialStage="steer"
        decision={makeDecision()}
        citations={[]}
        onClose={vi.fn()}
        onConfirmFork={onConfirmFork}
      />
    );

    const altButton = screen.getByRole("button", { name: /Optimize for cost over lift/ });
    fireEvent.click(altButton);
    fireEvent.click(altButton);

    fireEvent.click(screen.getByRole("button", { name: "Confirm fork" }));
    expect(onConfirmFork).toHaveBeenCalledWith({
      prompt: "Re-rank candidates assuming the budget cap drops by 30%."
    });
  });

  it("closes on Escape key when not forking", () => {
    const onClose = vi.fn();
    render(
      <DecisionModal
        open
        decision={makeDecision()}
        citations={[]}
        onClose={onClose}
        onConfirmFork={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <DecisionModal
        open
        decision={makeDecision()}
        citations={[]}
        onClose={onClose}
        onConfirmFork={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks Escape and backdrop while forking", () => {
    const onClose = vi.fn();
    render(
      <DecisionModal
        open
        isForking
        decision={makeDecision()}
        citations={[]}
        onClose={onClose}
        onConfirmFork={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });
});
