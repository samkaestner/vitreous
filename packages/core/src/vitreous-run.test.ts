import { describe, expect, it } from "vitest";
import {
  createVitreousRun,
  createVitreousRunIdFactory,
  replayVitreousEvents
} from "./vitreous-run.js";

function createTestRun() {
  return createVitreousRun(
    { runId: "run-test", rootBranchId: "branch-main", title: "Test run" },
    {
      runIdFactory: createVitreousRunIdFactory({ eventCounter: 0 }),
      now: () => "2026-01-01T00:00:00.000Z"
    }
  );
}

describe("vitreous-run", () => {
  it("records events and replays them into identical ThoughtTree state", () => {
    const run = createTestRun();
    const source = run.recordSource({
      source: {
        kind: "url",
        uri: "https://example.com/source",
        domain: "example.com"
      },
      excerpt: "Source excerpt"
    });
    const decision = run.recordDecision({
      claim: "Use the cited source",
      confidence: 0.82,
      provenance: [source.nodeId!],
      rationale: "The source directly supports the claim."
    });
    const action = run.requestActionApproval({
      action: {
        kind: "email.send",
        payload: { to: "user@example.com", subject: "Summary" },
        summary: "Send summary email",
        explanation: "The user requested an email follow-up."
      }
    });

    run.resolveActionApproval({
      executionNodeId: action.nodeId!,
      status: "allowed_once",
      decidedBy: "user",
      reason: "Approved in the supervision rail"
    });
    run.forkFromDecision({
      nodeId: decision.nodeId!,
      branchId: "branch-alt",
      name: "Alternative wording",
      steering: { prompt: "Make the answer stricter." }
    });
    run.switchBranch("branch-main");
    run.completeRun({ summary: "Completed" });

    const replayed = replayVitreousEvents(run.events, {
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(replayed.state).toEqual(run.state);
    expect(replayed.status).toBe("completed");
  });

  it("keeps explicit branch ids stable across fork and switch events", () => {
    const run = createTestRun();
    const source = run.recordSource({
      source: {
        kind: "memory",
        uri: "memory://source",
        title: "Memory"
      }
    });
    const decision = run.recordDecision({
      claim: "Branchable claim",
      confidence: 0.72,
      provenance: [source.nodeId!]
    });

    run.forkFromDecision({
      nodeId: decision.nodeId!,
      branchId: "branch-user-steered",
      steering: { selectedAlternativeId: "alt-1" }
    });
    run.switchBranch("branch-main");

    expect(run.state.activeBranchId).toBe("branch-main");
    expect(run.state.branchesById["branch-user-steered"].timeline).toEqual([
      source.nodeId,
      decision.nodeId
    ]);
  });

  it("validates conflict contenders during event ingestion", () => {
    const run = createTestRun();
    const source = run.recordSource({
      source: {
        kind: "url",
        uri: "https://example.com/a"
      }
    });

    expect(() =>
      run.recordConflict({
        contenders: [source.nodeId!],
        description: "Only one contender is not enough."
      })
    ).toThrow(/requires at least two contenders/);
  });

  it("serializes to JSON and restores from the event log", () => {
    const run = createTestRun();
    const source = run.recordSource({
      source: {
        kind: "file",
        uri: "file:///brief.md",
        title: "brief.md"
      }
    });
    run.recordDecision({
      claim: "Persisted decision",
      confidence: 0.91,
      provenance: [source.nodeId!]
    });

    const serialized = JSON.parse(JSON.stringify(run.serialize()));
    const restored = createVitreousRun({
      events: serialized.events
    });

    expect(restored.state).toEqual(run.state);
    expect(restored.events).toEqual(run.events);
  });
});
