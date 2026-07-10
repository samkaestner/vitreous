import type Anthropic from "@anthropic-ai/sdk";
import type { JsonValue, VitreousRunAPI } from "@vitreous/core";
import { SUPERVISION_PROTOCOL } from "./system-prompt.js";
import type { AdapterToolDef, SourceResult } from "./tools.js";

/**
 * The minimal structural shape of an Anthropic SDK client this adapter
 * needs. Deliberately narrower than the real `Anthropic` class so tests can
 * pass a mock without importing the SDK's client implementation — only its
 * types are imported here, and only for the message/param shapes.
 *
 * `tools`/`messages` are declared as mutable arrays (not `ReadonlyArray`) on
 * purpose: function parameters are checked contravariantly, and the real
 * `Anthropic` client's `messages.create` accepts mutable arrays — declaring
 * these as `ReadonlyArray` here would make `new Anthropic()` structurally
 * fail to satisfy this interface.
 */
export interface AnthropicClientLike {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system?: string;
      thinking?: Readonly<{ type: "adaptive" }>;
      tools?: Anthropic.Tool[];
      messages: Anthropic.MessageParam[];
    }): Promise<Anthropic.Message>;
  };
}

export type GateDecision = Readonly<{
  status: "allowed_once" | "always_allowed" | "rejected";
  modifiedPayload?: unknown;
  reason?: string;
}>;

export type AdapterPause =
  | Readonly<{
      type: "gate";
      executionNodeId: string;
      action: Readonly<{ kind: string; payload: unknown; summary: string }>;
    }>
  | Readonly<{
      type: "conflict";
      conflictNodeId: string;
      description: string;
      contenders: ReadonlyArray<Readonly<{ nodeId: string; sourceRef: string; title: string }>>;
    }>;

export type AdapterResult = Readonly<{
  status: "completed" | "failed";
  decision?: Readonly<{
    nodeId?: string;
    claim: string;
    confidence: number;
    rationale?: string;
  }>;
  events: ReadonlyArray<unknown>;
}>;

export type AdapterConfig = Readonly<{
  client: AnthropicClientLike;
  run: VitreousRunAPI;
  tools: ReadonlyArray<AdapterToolDef>;
  model?: string;
  maxTokens?: number;
  system?: string;
  onPause?: (pause: AdapterPause) => void;
  maxIterations?: number;
}>;

export interface AnthropicAdapter {
  ask(prompt: string): Promise<AdapterResult>;
  resolveGate(executionNodeId: string, decision: GateDecision): void;
  resolveConflict(conflictNodeId: string, chosenNodeId: string, note?: string): void;
}

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_ITERATIONS = 16;

type PendingDecision = Readonly<{
  nodeId?: string;
  claim: string;
  confidence: number;
  rationale?: string;
}>;

interface RecordDecisionInput {
  claim: string;
  confidence: number;
  rationale: string;
  provenance?: ReadonlyArray<string>;
}

interface FlagConflictInput {
  description: string;
  contenders?: ReadonlyArray<string>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stringifyResult(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result);
}

function buildAnthropicTools(tools: ReadonlyArray<AdapterToolDef>): Anthropic.Tool[] {
  const hostTools: Anthropic.Tool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as unknown as Anthropic.Tool["input_schema"],
  }));

  const flagConflictTool: Anthropic.Tool = {
    name: "flag_conflict",
    description:
      "Halt and ask the user to arbitrate when retrieved sources fundamentally contradict each other on the question at hand. Do not average or silently pick a side — call this instead.",
    input_schema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "What contradicts, and why.",
        },
        contenders: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          description: "The [src-N] reference strings of the disagreeing sources.",
        },
      },
      required: ["description", "contenders"],
    } as unknown as Anthropic.Tool["input_schema"],
  };

  const recordDecisionTool: Anthropic.Tool = {
    name: "record_decision",
    description:
      "Record the final decision for this task. Call this exactly once, when you are done, with the sources actually relied on.",
    input_schema: {
      type: "object",
      properties: {
        claim: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        rationale: { type: "string" },
        provenance: {
          type: "array",
          items: { type: "string" },
          description: "The [src-N] references actually relied on for this claim.",
        },
      },
      required: ["claim", "confidence", "rationale", "provenance"],
    } as unknown as Anthropic.Tool["input_schema"],
  };

  return [...hostTools, flagConflictTool, recordDecisionTool];
}

/**
 * Wraps an Anthropic tool-use loop with Vitreous supervision: retrievals
 * become citation nodes, contradictions halt the loop for human
 * arbitration, state-changing tools stop at approval gates, and the final
 * answer is recorded as a decision node grounded in citation provenance.
 *
 * The loop is run manually rather than via the SDK's tool runner, because
 * approval gates require suspending mid-loop until a human resolves them —
 * something an auto-executing tool runner cannot do.
 */
export function createAnthropicAdapter(config: AdapterConfig): AnthropicAdapter {
  const { client, run, tools } = config;
  const model = config.model ?? DEFAULT_MODEL;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const onPause = config.onPause;

  const systemPrompt = config.system ? `${config.system}\n\n${SUPERVISION_PROTOCOL}` : SUPERVISION_PROTOCOL;
  const anthropicTools = buildAnthropicTools(tools);
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool] as const));

  // Run-scoped supervision state. Persists across `ask()` calls on the same
  // adapter instance, mirroring the run-scoped nature of always-allow and
  // source-ref numbering.
  const sourceNodeIdByRef = new Map<string, string>();
  const sourceTitleByRef = new Map<string, string>();
  let sourceCounter = 0;
  const alwaysAllowed = new Set<string>();
  const pendingGates = new Map<string, (decision: GateDecision) => void>();
  const pendingConflicts = new Map<string, (result: Readonly<{ chosenNodeId: string; note?: string }>) => void>();
  // Boxed so `handleRecordDecision` can write into the per-`ask()`-call
  // decision slot without threading a mutable parameter through the whole
  // tool-dispatch call chain.
  const pendingDecisionRef: { current: PendingDecision | undefined } = { current: undefined };

  function resolveGate(executionNodeId: string, decision: GateDecision): void {
    const resolve = pendingGates.get(executionNodeId);
    if (!resolve) {
      throw new Error(`AnthropicAdapter: no pending gate for execution node "${executionNodeId}"`);
    }
    pendingGates.delete(executionNodeId);
    resolve(decision);
  }

  function resolveConflict(conflictNodeId: string, chosenNodeId: string, note?: string): void {
    const resolve = pendingConflicts.get(conflictNodeId);
    if (!resolve) {
      throw new Error(`AnthropicAdapter: no pending conflict for node "${conflictNodeId}"`);
    }
    pendingConflicts.delete(conflictNodeId);
    resolve({ chosenNodeId, note });
  }

  async function handleSourceToolUse(
    toolUseId: string,
    tool: Extract<AdapterToolDef, { kind: "source" }>,
    input: unknown
  ): Promise<Anthropic.ToolResultBlockParam> {
    let raw: unknown;
    try {
      raw = await tool.execute(input);
    } catch (err) {
      return { type: "tool_result", tool_use_id: toolUseId, content: errorMessage(err), is_error: true };
    }

    const results: SourceResult[] = Array.isArray(raw) ? raw : [raw as SourceResult];
    const lines: string[] = [];
    for (const result of results) {
      sourceCounter += 1;
      const ref = `src-${sourceCounter}`;
      const title = result.title ?? result.uri;
      const recorded = run.recordSource({
        source: { kind: result.kind ?? "file", uri: result.uri, title: result.title },
        excerpt: result.excerpt,
        contentHash: result.contentHash,
      });
      if (recorded.nodeId) {
        sourceNodeIdByRef.set(ref, recorded.nodeId);
        sourceTitleByRef.set(ref, title);
      }
      lines.push(`[${ref}] ${title}\n${result.excerpt ?? ""}`);
    }

    return { type: "tool_result", tool_use_id: toolUseId, content: lines.join("\n\n") };
  }

  async function handlePlainToolUse(
    toolUseId: string,
    tool: Extract<AdapterToolDef, { kind: "plain" }>,
    input: unknown
  ): Promise<Anthropic.ToolResultBlockParam> {
    try {
      const result = await tool.execute(input);
      return { type: "tool_result", tool_use_id: toolUseId, content: stringifyResult(result) };
    } catch (err) {
      return { type: "tool_result", tool_use_id: toolUseId, content: errorMessage(err), is_error: true };
    }
  }

  async function executeGatedTool(
    toolUseId: string,
    tool: Extract<AdapterToolDef, { kind: "gated" }>,
    payload: unknown
  ): Promise<Anthropic.ToolResultBlockParam> {
    try {
      const result = await tool.execute(payload);
      return { type: "tool_result", tool_use_id: toolUseId, content: stringifyResult(result) };
    } catch (err) {
      return { type: "tool_result", tool_use_id: toolUseId, content: errorMessage(err), is_error: true };
    }
  }

  async function handleGatedToolUse(
    toolUseId: string,
    tool: Extract<AdapterToolDef, { kind: "gated" }>,
    input: unknown
  ): Promise<Anthropic.ToolResultBlockParam> {
    const summary = tool.summary ? tool.summary(input) : `Call ${tool.name}`;
    // Tool inputs are arbitrary JSON-serializable values at the SDK boundary
    // (they arrive as parsed `tool_use.input`), so this cast is safe — the
    // wider `unknown` on `execute`/`summary` is about developer ergonomics,
    // not about accepting non-JSON values.
    const action = { kind: tool.name, payload: input as JsonValue, summary, explanation: tool.explanation };

    if (alwaysAllowed.has(tool.name)) {
      const requested = run.requestActionApproval({ action });
      const executionNodeId = requested.nodeId as string;
      run.resolveActionApproval({
        executionNodeId,
        status: "always_allowed",
        decidedBy: "user",
        reason: "Covered by prior always-allow",
      });
      return executeGatedTool(toolUseId, tool, input);
    }

    const requested = run.requestActionApproval({ action });
    const executionNodeId = requested.nodeId as string;

    const decision = await new Promise<GateDecision>((resolve) => {
      pendingGates.set(executionNodeId, resolve);
      onPause?.({
        type: "gate",
        executionNodeId,
        action: { kind: action.kind, payload: action.payload, summary: action.summary },
      });
    });

    if (decision.status === "rejected") {
      run.resolveActionApproval({
        executionNodeId,
        status: "rejected",
        decidedBy: "user",
        reason: decision.reason,
      });
      const text = `The user rejected this action${decision.reason ? `: ${decision.reason}` : ""}. Do not retry it; adjust your approach or proceed without it.`;
      return { type: "tool_result", tool_use_id: toolUseId, content: text };
    }

    if (decision.status === "always_allowed") {
      alwaysAllowed.add(tool.name);
    }

    const hasModifiedPayload = decision.modifiedPayload !== undefined;
    run.resolveActionApproval({
      executionNodeId,
      status: decision.status,
      decidedBy: "user",
      reason: hasModifiedPayload ? "payload modified by user" : undefined,
    });

    const payloadToUse = hasModifiedPayload ? decision.modifiedPayload : input;
    return executeGatedTool(toolUseId, tool, payloadToUse);
  }

  async function handleFlagConflict(toolUseId: string, input: FlagConflictInput): Promise<Anthropic.ToolResultBlockParam> {
    const contenderRefs = input.contenders ?? [];
    const contenderInfo: Array<Readonly<{ nodeId: string; sourceRef: string; title: string }>> = [];
    for (const ref of contenderRefs) {
      const nodeId = sourceNodeIdByRef.get(ref);
      if (!nodeId) continue; // unknown ref: ignore
      contenderInfo.push({ nodeId, sourceRef: ref, title: sourceTitleByRef.get(ref) ?? ref });
    }

    if (contenderInfo.length < 2) {
      return {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: "Unknown source refs: at least two valid, previously-cited [src-N] references are required to flag a conflict.",
        is_error: true,
      };
    }

    const recorded = run.recordConflict({
      contenders: contenderInfo.map((c) => c.nodeId),
      description: input.description,
    });
    const conflictNodeId = recorded.nodeId as string;

    const { chosenNodeId, note } = await new Promise<Readonly<{ chosenNodeId: string; note?: string }>>((resolve) => {
      pendingConflicts.set(conflictNodeId, resolve);
      onPause?.({
        type: "conflict",
        conflictNodeId,
        description: input.description,
        contenders: contenderInfo,
      });
    });

    run.resolveRecordedConflict({ conflictNodeId, chosenNodeId, note });

    const chosen = contenderInfo.find((c) => c.nodeId === chosenNodeId);
    const chosenRef = chosen?.sourceRef ?? chosenNodeId;
    const chosenTitle = chosen?.title ?? "";
    const text = `Conflict resolved by the user. Authoritative source: [${chosenRef}] ${chosenTitle}. Weight this source in your synthesis; acknowledge the other only where it does not contradict it. Do not flag this conflict again.`;
    return { type: "tool_result", tool_use_id: toolUseId, content: text };
  }

  function handleRecordDecision(toolUseId: string, input: RecordDecisionInput): Anthropic.ToolResultBlockParam {
    const provenance = (input.provenance ?? [])
      .map((ref) => sourceNodeIdByRef.get(ref))
      .filter((id): id is string => Boolean(id));

    const confidence = Math.min(1, Math.max(0, input.confidence));

    const recorded = run.recordDecision({
      claim: input.claim,
      confidence,
      rationale: input.rationale,
      provenance,
    });

    pendingDecisionRef.current = {
      nodeId: recorded.nodeId,
      claim: input.claim,
      confidence,
      rationale: input.rationale,
    };

    return { type: "tool_result", tool_use_id: toolUseId, content: "Decision recorded." };
  }

  async function dispatchToolUse(block: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
    const { id, name, input } = block;

    if (name === "flag_conflict") {
      return handleFlagConflict(id, input as FlagConflictInput);
    }
    if (name === "record_decision") {
      return handleRecordDecision(id, input as RecordDecisionInput);
    }

    const tool = toolsByName.get(name);
    if (!tool) {
      return { type: "tool_result", tool_use_id: id, content: `Unknown tool: ${name}`, is_error: true };
    }

    if (tool.kind === "source") {
      return handleSourceToolUse(id, tool, input);
    }
    if (tool.kind === "gated") {
      return handleGatedToolUse(id, tool, input);
    }
    return handlePlainToolUse(id, tool, input);
  }

  async function ask(prompt: string): Promise<AdapterResult> {
    run.recordSource({
      source: { kind: "user", uri: "user://prompt", title: "User prompt" },
      excerpt: prompt,
    });

    pendingDecisionRef.current = undefined;
    let lastAssistantText: string | undefined;
    let messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

    let iteration = 0;
    for (;;) {
      iteration += 1;
      if (iteration > maxIterations) {
        run.failRun({ message: `Exceeded maxIterations (${maxIterations})`, code: "max_iterations" });
        throw new Error(`AnthropicAdapter: exceeded maxIterations (${maxIterations}) without reaching a terminal stop_reason`);
      }

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        thinking: { type: "adaptive" },
        tools: anthropicTools,
        messages,
      });

      if (response.stop_reason === "refusal") {
        run.failRun({ message: "Model refused", code: "refusal" });
        return { status: "failed", events: run.events };
      }

      if (response.stop_reason === "max_tokens") {
        run.failRun({ message: "max_tokens reached", code: "max_tokens" });
        return { status: "failed", events: run.events };
      }

      if (response.stop_reason === "tool_use") {
        messages = [...messages, { role: "assistant", content: response.content }];

        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          toolResults.push(await dispatchToolUse(block));
        }

        messages = [...messages, { role: "user", content: toolResults }];
        continue;
      }

      if (response.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content: response.content }];
        continue;
      }

      // "end_turn" (or any other terminal stop reason): exit the loop.
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      lastAssistantText = textBlocks.map((block) => block.text).join("\n");
      break;
    }

    // Cast rather than a bare read: TypeScript's narrowing of `ref.current`
    // doesn't account for the mutation happening inside a closure
    // (`handleRecordDecision`) called during the loop above, and would
    // otherwise incorrectly narrow this to `undefined`.
    const decision = pendingDecisionRef.current as PendingDecision | undefined;
    run.completeRun({ summary: decision ? decision.claim : lastAssistantText });
    return { status: "completed", decision, events: run.events };
  }

  return { ask, resolveGate, resolveConflict };
}
