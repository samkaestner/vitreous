/**
 * Tool classification helpers.
 *
 * A host application's tools fall into three supervision-relevant buckets:
 *
 * - `sourceTool` — retrieves evidence. Every result becomes a citation node
 *   in the Vitreous event log, and is assigned a stable `[src-N]` reference
 *   the model must cite.
 * - `gatedTool` — changes state. Every invocation stops at an approval gate
 *   (an `execution` node) before it runs.
 * - `plainTool` — anything else. Executes immediately, no node recorded.
 *
 * The adapter (`src/adapter.ts`) dispatches on which bucket a tool call
 * lands in; these builders exist to make that classification explicit at
 * the call site rather than inferred from tool names or side effects.
 */

/** JSON Schema object shape expected by the Anthropic `input_schema` field. */
export type JsonSchema = Readonly<Record<string, unknown>>;

/** One piece of evidence returned by a source tool. */
export type SourceResult = Readonly<{
  uri: string;
  title?: string;
  excerpt?: string;
  contentHash?: string;
  kind?: "url" | "file" | "memory";
}>;

type BaseToolDef<TResult> = Readonly<{
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: unknown) => Promise<TResult>;
}>;

/** A retrieval tool. Results are recorded as citation nodes. */
export type SourceToolDef = BaseToolDef<SourceResult[] | SourceResult>;

/** A state-changing tool. Every call stops at an approval gate. */
export type GatedToolDef = BaseToolDef<unknown> &
  Readonly<{
    /** Human-readable one-line summary of what this specific call would do. */
    summary?: (input: unknown) => string;
    /** Optional longer explanation surfaced alongside the summary. */
    explanation?: string;
  }>;

/** A read-only, non-recorded tool. Executes immediately. */
export type PlainToolDef = BaseToolDef<unknown>;

/** Discriminated union of the three tool classifications the adapter understands. */
export type AdapterToolDef =
  | (SourceToolDef & Readonly<{ kind: "source" }>)
  | (GatedToolDef & Readonly<{ kind: "gated" }>)
  | (PlainToolDef & Readonly<{ kind: "plain" }>);

/**
 * Declare a retrieval tool. `execute` should return one or more
 * `SourceResult`s; each becomes a `source.added` event and a `[src-N]`
 * reference the model can cite in its final decision.
 */
export function sourceTool(def: SourceToolDef): AdapterToolDef {
  return { ...def, kind: "source" };
}

/**
 * Declare a state-changing tool. Every call is intercepted and routed
 * through `run.requestActionApproval` before `execute` runs — unless the
 * tool name is already in the run-scoped always-allowed set, in which case
 * it still logs the approval but does not block on a human decision.
 */
export function gatedTool(
  def: BaseToolDef<unknown> &
    Readonly<{ summary?: (input: unknown) => string; explanation?: string }>
): AdapterToolDef {
  return { ...def, kind: "gated" };
}

/**
 * Declare a plain tool. Executes immediately with no gate and no node
 * recorded — appropriate for read-only helpers that aren't evidence
 * retrieval (e.g. a calculator, a clock, a unit converter).
 */
export function plainTool(def: PlainToolDef): AdapterToolDef {
  return { ...def, kind: "plain" };
}
