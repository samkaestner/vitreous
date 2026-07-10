export { createAnthropicAdapter } from "./adapter.js";
export type {
  AdapterConfig,
  AdapterPause,
  AdapterResult,
  AnthropicAdapter,
  AnthropicClientLike,
  GateDecision,
} from "./adapter.js";

export { gatedTool, plainTool, sourceTool } from "./tools.js";
export type {
  AdapterToolDef,
  GatedToolDef,
  JsonSchema,
  PlainToolDef,
  SourceResult,
  SourceToolDef,
} from "./tools.js";

export { SUPERVISION_PROTOCOL } from "./system-prompt.js";
