/**
 * gran-fondo.ts — a headless recreation of the Vitreous playground's
 * flagship scenario: two training studies that flatly contradict each
 * other on how to train for a gran fondo, a search tool that surfaces both,
 * a gated tool that persists the resulting plan, and a human in the loop
 * arbitrating the contradiction and approving the state-changing action
 * from the terminal.
 *
 * This is the whole pitch for @vitreous/adapter-anthropic in one script:
 * the model can't quietly average two contradictory sources, and it can't
 * silently save a plan to disk. Both moments stop and hand control to a
 * human, and the full decision — with its provenance — is reconstructible
 * afterwards purely from the event log.
 *
 * Run with: npx tsx examples/gran-fondo.ts
 * Requires ANTHROPIC_API_KEY in the environment — this makes real API calls.
 */

import { createInterface } from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";
import { createVitreousRun } from "@vitreous/core";
import {
  createAnthropicAdapter,
  gatedTool,
  sourceTool,
  type AdapterPause,
} from "@vitreous/adapter-anthropic";

// ---------------------------------------------------------------------------
// The two studies. These are the same contradictory claims the playground's
// UI demo uses: one recommends training majority-high-intensity, the other
// recommends majority-low-intensity — and they disagree on the underlying
// physiological mechanism, not just the number.
// ---------------------------------------------------------------------------

const HIIT_STUDY = `# High-Intensity Interval Training (HIIT) as the Primary Driver of VO2 Max

**Abstract**: A meta-analysis of endurance protocols reveals that prolonged low-intensity training yields diminishing returns for cardiovascular output.
**Findings**:
- Athletes performing HIIT sessions (Zone 5) for 60% of their weekly volume saw rapid and sustained increases in VO2 Max over a 12-week period.
- Low-intensity training (Zone 2) was found to be an inefficient use of time for non-elite athletes, contributing minimally to top-end speed or aerobic capacity gains.
- We recommend a training split consisting of a majority (60%+) of high-intensity threshold and interval work for optimal gran fondo preparation.`;

const ZONE2_STUDY = `# The Superiority of Zone 2 Volume for Endurance Adaptations

**Abstract**: This study investigates the impact of low-intensity, high-volume (Zone 2) training on VO2 max and mitochondrial density in elite and amateur gran fondo runners.
**Findings**:
- Athletes who spent 80% of their training volume in Zone 2 experienced a 12% greater increase in mitochondrial density compared to the control group.
- Zone 2 training at high volumes builds the necessary aerobic base and capillary density required for sustained gran fondo pacing.
- The recommended training split is 80/20 (80% Zone 2, 20% high intensity).`;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const searchStudies = sourceTool({
  name: "search_studies",
  description: "Search the training-science literature for studies relevant to a gran fondo training question.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to search for" },
    },
    required: ["query"],
  },
  // A real implementation would hit a vector store or search API. Here both
  // studies are always returned — the point is the adapter's reaction to
  // contradictory evidence, not retrieval quality.
  execute: async () => [
    { uri: "internal://studies/hiit-vo2max", title: "HIIT as the Primary Driver of VO2 Max", excerpt: HIIT_STUDY },
    { uri: "internal://studies/zone2-endurance", title: "The Superiority of Zone 2 Volume", excerpt: ZONE2_STUDY },
  ],
});

const saveTrainingPlan = gatedTool({
  name: "save_training_plan",
  description: "Persist the finalized training plan to the user's account.",
  inputSchema: {
    type: "object",
    properties: {
      plan: { type: "string", description: "The training plan to save, in plain language." },
    },
    required: ["plan"],
  },
  summary: (input) => `Save training plan: ${JSON.stringify(input)}`,
  // Pretend-persists — this is an example, not a database.
  execute: async (input) => {
    console.log("\n[save_training_plan] Persisted:", input);
    return "saved";
  },
});

// ---------------------------------------------------------------------------
// Human-in-the-loop arbitration, from the terminal.
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function handlePause(pause: AdapterPause, resolveGate: (id: string, decision: Parameters<typeof adapter.resolveGate>[1]) => void, resolveConflict: typeof adapter.resolveConflict): Promise<void> {
  if (pause.type === "conflict") {
    console.log("\n--- The model hit contradictory evidence and stopped. ---");
    console.log(pause.description);
    pause.contenders.forEach((c, i) => {
      console.log(`  ${i + 1}. [${c.sourceRef}] ${c.title}`);
    });
    const answer = await rl.question("Which source should win? (enter a number): ");
    const index = Number.parseInt(answer, 10) - 1;
    const chosen = pause.contenders[index] ?? pause.contenders[0]!;
    const note = await rl.question("Optional note on why (enter to skip): ");
    resolveConflict(pause.conflictNodeId, chosen.nodeId, note || undefined);
    return;
  }

  console.log("\n--- The model wants to take a state-changing action. ---");
  console.log(pause.action.summary);
  const answer = await rl.question("Allow this? (y = once, a = always, n = reject): ");
  if (answer.trim().toLowerCase() === "a") {
    resolveGate(pause.executionNodeId, { status: "always_allowed" });
  } else if (answer.trim().toLowerCase() === "y") {
    resolveGate(pause.executionNodeId, { status: "allowed_once" });
  } else {
    const reason = await rl.question("Reason for rejecting (enter to skip): ");
    resolveGate(pause.executionNodeId, { status: "rejected", reason: reason || undefined });
  }
}

// ---------------------------------------------------------------------------
// Wire it up and run.
// ---------------------------------------------------------------------------

const run = createVitreousRun({ title: "Gran fondo training plan" });

const adapter = createAnthropicAdapter({
  client: new Anthropic(), // reads ANTHROPIC_API_KEY from the environment
  run,
  model: "claude-opus-4-8",
  tools: [searchStudies, saveTrainingPlan],
  onPause: (pause) => {
    // Fire-and-forget: handlePause awaits terminal input and resolves the
    // adapter's pending promise once the human answers.
    void handlePause(pause, adapter.resolveGate, adapter.resolveConflict);
  },
});

async function main(): Promise<void> {
  const result = await adapter.ask(
    "How should I train for an upcoming gran fondo? Once you've decided, save the plan."
  );

  console.log("\n=== Decision ===");
  if (result.decision) {
    console.log("Claim:     ", result.decision.claim);
    console.log("Confidence:", result.decision.confidence);
    if (result.decision.rationale) {
      console.log("Rationale: ", result.decision.rationale);
    }
  } else {
    console.log("(no decision was recorded — status:", result.status, ")");
  }

  // The audit trail is the payoff: every citation, the conflict and its
  // resolution, the approval gate, and the final decision are all
  // reconstructible from this event log alone.
  console.log("\n=== Full event log (the audit trail) ===");
  console.log(JSON.stringify(result.events, null, 2));

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
