import type Anthropic from "@anthropic-ai/sdk";
import { createVitreousRun } from "@vitreous/core";
import { describe, expect, it, vi } from "vitest";
import type { AnthropicClientLike, AdapterPause } from "./adapter.js";
import { createAnthropicAdapter } from "./adapter.js";
import { gatedTool, plainTool, sourceTool } from "./tools.js";

// ---------------------------------------------------------------------------
// Test helpers: a queued mock client, and small builders for realistic
// Anthropic Message / content-block shapes. No live API calls are made
// anywhere in this file.
// ---------------------------------------------------------------------------

/** Records every `create` call's params and replays queued responses in order. */
function mockClient(responses: ReadonlyArray<Anthropic.Message>) {
  const calls: unknown[] = [];
  let index = 0;
  const client: AnthropicClientLike = {
    messages: {
      create: async (params) => {
        calls.push(params);
        const response = responses[index];
        index += 1;
        if (!response) {
          throw new Error(`mockClient: no queued response for call #${calls.length}`);
        }
        return response;
      },
    },
  };
  return { client, calls: calls as Array<{ messages: Anthropic.MessageParam[] }> };
}

let messageCounter = 0;
function nextId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}_${messageCounter}`;
}

function textBlock(text: string): Anthropic.TextBlock {
  return { type: "text", text, citations: [] } as unknown as Anthropic.TextBlock;
}

function toolUseBlock(name: string, input: unknown, id?: string): Anthropic.ToolUseBlock {
  return { type: "tool_use", id: id ?? nextId("toolu"), name, input } as unknown as Anthropic.ToolUseBlock;
}

function usage(): Anthropic.Usage {
  return {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    server_tool_use: null,
    service_tier: null,
  } as unknown as Anthropic.Usage;
}

function assistantMessage(
  content: ReadonlyArray<unknown>,
  stopReason: string
): Anthropic.Message {
  return {
    id: nextId("msg"),
    type: "message",
    role: "assistant",
    model: "claude-opus-4-8",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: usage(),
  } as unknown as Anthropic.Message;
}

/** Yields control long enough for a chain of already-resolved promises to settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function lastUserMessage(calls: Array<{ messages: Anthropic.MessageParam[] }>, callIndex: number): Anthropic.MessageParam {
  const messages = calls[callIndex].messages;
  return messages[messages.length - 1];
}

// ---------------------------------------------------------------------------

describe("createAnthropicAdapter", () => {
  it("happy path: records citations, maps provenance, completes the run", async () => {
    const run = createVitreousRun();
    const searchExecute = vi.fn(async () => [
      { uri: "https://example.com/hiit", title: "HIIT study", excerpt: "HIIT drives VO2 max gains." },
      { uri: "https://example.com/zone2", title: "Zone 2 study", excerpt: "Zone 2 builds aerobic base." },
    ]);
    const searchTool = sourceTool({
      name: "search_studies",
      description: "Search training studies",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      execute: searchExecute,
    });

    const { client, calls } = mockClient([
      assistantMessage([toolUseBlock("search_studies", { query: "marathon training" })], "tool_use"),
      assistantMessage(
        [
          toolUseBlock("record_decision", {
            claim: "Zone 2 training builds the aerobic base needed for marathon pacing.",
            confidence: 0.8,
            rationale: "Supported by the retrieved Zone 2 study.",
            provenance: ["src-2"],
          }),
        ],
        "tool_use"
      ),
      assistantMessage([textBlock("Done.")], "end_turn"),
    ]);

    const adapter = createAnthropicAdapter({ client, run, tools: [searchTool] });
    const result = await adapter.ask("How should I train for a marathon?");

    expect(result.status).toBe("completed");
    expect(result.decision?.claim).toBe("Zone 2 training builds the aerobic base needed for marathon pacing.");
    expect(result.decision?.confidence).toBe(0.8);

    const events = run.events;
    const sourceEvents = events.filter((e) => e.type === "source.added");
    // user prompt + 2 retrieved sources
    expect(sourceEvents).toHaveLength(3);

    const decisionEvents = events.filter((e) => e.type === "decision.made");
    expect(decisionEvents).toHaveLength(1);
    const decisionPayload = decisionEvents[0]!.payload as unknown as { provenance: string[] };
    // record_decision cited only src-2 (the second retrieved source, i.e.
    // sourceEvents[2] since sourceEvents[0] is the user prompt).
    expect(decisionPayload.provenance).toHaveLength(1);
    expect(typeof decisionPayload.provenance[0]).toBe("string");

    expect(events.some((e) => e.type === "run.completed")).toBe(true);
    expect(calls).toHaveLength(3);

    // tool_result text for the search call should carry both refs
    const firstToolResultMessage = lastUserMessage(calls, 1);
    const content = firstToolResultMessage.content as Anthropic.ToolResultBlockParam[];
    const searchResultText = content[0]!.content as string;
    expect(searchResultText).toContain("[src-1]");
    expect(searchResultText).toContain("[src-2]");
  });

  it("conflict path: suspends on flag_conflict until resolveConflict is called", async () => {
    const run = createVitreousRun();
    const searchTool = sourceTool({
      name: "search_studies",
      description: "Search training studies",
      inputSchema: { type: "object", properties: {} },
      execute: async () => [
        { uri: "https://example.com/hiit", title: "HIIT study", excerpt: "60%+ HIIT volume drives VO2 max gains." },
        { uri: "https://example.com/zone2", title: "Zone 2 study", excerpt: "80% Zone 2 volume builds aerobic base." },
      ],
    });

    const { client, calls } = mockClient([
      assistantMessage([toolUseBlock("search_studies", {})], "tool_use"),
      assistantMessage(
        [
          toolUseBlock("flag_conflict", {
            description: "HIIT study recommends 60%+ high intensity; Zone 2 study recommends 80% low intensity. Contradictory.",
            contenders: ["src-1", "src-2"],
          }),
        ],
        "tool_use"
      ),
      assistantMessage([textBlock("Understood, proceeding with the arbitrated source.")], "end_turn"),
    ]);

    const pauses: AdapterPause[] = [];
    const adapter = createAnthropicAdapter({
      client,
      run,
      tools: [searchTool],
      onPause: (pause) => pauses.push(pause),
    });

    const resultPromise = adapter.ask("How should I train for a marathon?");

    // Let the search turn and the flag_conflict turn both run; the loop
    // should then be suspended awaiting resolveConflict, with no further
    // `create` calls made.
    await flushAsync();
    await flushAsync();

    expect(calls).toHaveLength(2);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]!.type).toBe("conflict");
    const conflictPause = pauses[0]! as Extract<AdapterPause, { type: "conflict" }>;
    expect(conflictPause.contenders).toHaveLength(2);
    expect(conflictPause.contenders.map((c) => c.sourceRef).sort()).toEqual(["src-1", "src-2"]);

    // Still suspended: a further flush should not advance the call count.
    await flushAsync();
    expect(calls).toHaveLength(2);

    adapter.resolveConflict(conflictPause.conflictNodeId, conflictPause.contenders[1]!.nodeId, "User prefers Zone 2 evidence.");

    const result = await resultPromise;
    expect(result.status).toBe("completed");
    expect(calls).toHaveLength(3);

    const events = run.events;
    expect(events.some((e) => e.type === "conflict.detected")).toBe(true);
    expect(events.some((e) => e.type === "conflict.resolved")).toBe(true);

    const toolResultMessage = lastUserMessage(calls, 2);
    const content = toolResultMessage.content as Anthropic.ToolResultBlockParam[];
    const resolutionText = content[0]!.content as string;
    expect(resolutionText).toContain("[src-2]");
    expect(resolutionText).toContain("Zone 2 study");
  });

  it("gate allow: suspends on a gated tool, executes only after allowed_once", async () => {
    const run = createVitreousRun();
    const execute = vi.fn(async () => "saved");
    const saveTool = gatedTool({
      name: "save_training_plan",
      description: "Persist a training plan",
      inputSchema: { type: "object", properties: { plan: { type: "string" } } },
      summary: () => "Save the training plan",
      execute,
    });

    const { client } = mockClient([
      assistantMessage([toolUseBlock("save_training_plan", { plan: "80/20 split" })], "tool_use"),
      assistantMessage([textBlock("Saved.")], "end_turn"),
    ]);

    const pauses: AdapterPause[] = [];
    const adapter = createAnthropicAdapter({
      client,
      run,
      tools: [saveTool],
      onPause: (pause) => pauses.push(pause),
    });

    const resultPromise = adapter.ask("Save my plan.");
    await flushAsync();

    expect(pauses).toHaveLength(1);
    expect(pauses[0]!.type).toBe("gate");
    const gatePause = pauses[0]! as Extract<AdapterPause, { type: "gate" }>;
    expect(execute).not.toHaveBeenCalled();

    adapter.resolveGate(gatePause.executionNodeId, { status: "allowed_once" });
    const result = await resultPromise;

    expect(result.status).toBe("completed");
    expect(execute).toHaveBeenCalledWith({ plan: "80/20 split" });

    const events = run.events;
    expect(events.some((e) => e.type === "action.requested")).toBe(true);
    const resolved = events.find((e) => e.type === "action.resolved");
    expect(resolved).toBeDefined();
    expect((resolved!.payload as { status: string }).status).toBe("allowed_once");
  });

  it("gate reject: execute is never called, and the model is told it was rejected", async () => {
    const run = createVitreousRun();
    const execute = vi.fn(async () => "saved");
    const saveTool = gatedTool({
      name: "save_training_plan",
      description: "Persist a training plan",
      inputSchema: { type: "object", properties: { plan: { type: "string" } } },
      execute,
    });

    const { client, calls } = mockClient([
      assistantMessage([toolUseBlock("save_training_plan", { plan: "80/20 split" })], "tool_use"),
      assistantMessage([textBlock("Understood.")], "end_turn"),
    ]);

    const pauses: AdapterPause[] = [];
    const adapter = createAnthropicAdapter({
      client,
      run,
      tools: [saveTool],
      onPause: (pause) => pauses.push(pause),
    });
    const resultPromise = adapter.ask("Save my plan.");
    await flushAsync();

    expect(pauses).toHaveLength(1);
    const gatePause = pauses[0]! as Extract<AdapterPause, { type: "gate" }>;

    adapter.resolveGate(gatePause.executionNodeId, { status: "rejected", reason: "Not right now." });
    const result = await resultPromise;

    expect(result.status).toBe("completed");
    expect(execute).not.toHaveBeenCalled();

    const resolved = run.events.find((e) => e.type === "action.resolved");
    expect((resolved!.payload as { status: string }).status).toBe("rejected");

    const toolResultMessage = lastUserMessage(calls, 1);
    const content = toolResultMessage.content as Anthropic.ToolResultBlockParam[];
    const text = content[0]!.content as string;
    expect(text).toContain("rejected");
  });

  it("always-allow: second invocation of the same tool skips onPause but still logs an approval pair", async () => {
    const run = createVitreousRun();
    const execute = vi.fn(async (input: unknown) => `saved:${JSON.stringify(input)}`);
    const saveTool = gatedTool({
      name: "save_training_plan",
      description: "Persist a training plan",
      inputSchema: { type: "object", properties: { plan: { type: "string" } } },
      execute,
    });

    const { client, calls } = mockClient([
      assistantMessage([toolUseBlock("save_training_plan", { plan: "first" })], "tool_use"),
      assistantMessage([toolUseBlock("save_training_plan", { plan: "second" })], "tool_use"),
      assistantMessage([textBlock("Done.")], "end_turn"),
    ]);

    const pauses: AdapterPause[] = [];
    const adapter = createAnthropicAdapter({
      client,
      run,
      tools: [saveTool],
      onPause: (pause) => pauses.push(pause),
    });

    const resultPromise = adapter.ask("Save my plan twice.");
    await flushAsync();

    expect(pauses).toHaveLength(1);
    const gatePause = pauses[0]! as Extract<AdapterPause, { type: "gate" }>;
    adapter.resolveGate(gatePause.executionNodeId, { status: "always_allowed" });

    const result = await resultPromise;
    expect(result.status).toBe("completed");

    // Only ONE onPause — the second invocation proceeded without pausing.
    expect(pauses).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(3);

    const requestedEvents = run.events.filter((e) => e.type === "action.requested");
    const resolvedEvents = run.events.filter((e) => e.type === "action.resolved");
    expect(requestedEvents).toHaveLength(2);
    expect(resolvedEvents).toHaveLength(2);
    expect(resolvedEvents.every((e) => (e.payload as { status: string }).status === "always_allowed")).toBe(true);
  });

  it("parallel tool_use blocks: both execute, and both results land in one user message", async () => {
    const run = createVitreousRun();
    const executeA = vi.fn(async () => [{ uri: "https://example.com/a", title: "Source A", excerpt: "Claim A." }]);
    const executeB = vi.fn(async () => [{ uri: "https://example.com/b", title: "Source B", excerpt: "Claim B." }]);
    const toolA = sourceTool({
      name: "search_a",
      description: "Search source A",
      inputSchema: { type: "object", properties: {} },
      execute: executeA,
    });
    const toolB = sourceTool({
      name: "search_b",
      description: "Search source B",
      inputSchema: { type: "object", properties: {} },
      execute: executeB,
    });

    const { client, calls } = mockClient([
      assistantMessage([toolUseBlock("search_a", {}), toolUseBlock("search_b", {})], "tool_use"),
      assistantMessage([textBlock("Done.")], "end_turn"),
    ]);

    const adapter = createAnthropicAdapter({ client, run, tools: [toolA, toolB] });
    const result = await adapter.ask("Gather sources.");

    expect(result.status).toBe("completed");
    expect(executeA).toHaveBeenCalledTimes(1);
    expect(executeB).toHaveBeenCalledTimes(1);

    // messages sent on the second `create` call: [...prior, assistant(tool_use x2), user(tool_result x2)]
    const secondCallMessages = calls[1]!.messages;
    const lastMessage = secondCallMessages[secondCallMessages.length - 1]!;
    expect(lastMessage.role).toBe("user");
    const content = lastMessage.content as Anthropic.ToolResultBlockParam[];
    expect(content).toHaveLength(2);

    const sourceEvents = run.events.filter((e) => e.type === "source.added");
    expect(sourceEvents).toHaveLength(3); // user prompt + A + B
  });

  it("refusal: fails the run and returns a failed result without reading content", async () => {
    const run = createVitreousRun();
    const { client } = mockClient([assistantMessage([], "refusal")]);

    const adapter = createAnthropicAdapter({ client, run, tools: [] });
    const result = await adapter.ask("Do something unsafe.");

    expect(result.status).toBe("failed");
    expect(run.events.some((e) => e.type === "run.failed")).toBe(true);
  });

  it("maxIterations: exceeding the guard fails the run and throws", async () => {
    const run = createVitreousRun();
    const noop = plainTool({
      name: "noop",
      description: "Does nothing",
      inputSchema: { type: "object", properties: {} },
      execute: async () => "ok",
    });

    const { client, calls } = mockClient([
      assistantMessage([toolUseBlock("noop", {})], "tool_use"),
      assistantMessage([toolUseBlock("noop", {})], "tool_use"),
      assistantMessage([toolUseBlock("noop", {})], "tool_use"),
    ]);

    const adapter = createAnthropicAdapter({ client, run, tools: [noop], maxIterations: 2 });

    await expect(adapter.ask("Loop forever.")).rejects.toThrow(/maxIterations/);
    // Only 2 calls should have been made before the guard tripped.
    expect(calls).toHaveLength(2);
    expect(run.events.some((e) => e.type === "run.failed")).toBe(true);
  });
});
