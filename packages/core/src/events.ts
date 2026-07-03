import type {
  AddNodeInput,
  ForkAtNodeInput,
  ForkSteering,
  ResolveConflictInput,
  UpdateExecutionGateInput
} from "./thought-tree.js";
import type {
  BranchId,
  ExecutionGateStatus,
  ExecutionNode,
  IsoDateTime,
  NodeId
} from "./nodes.js";

export const VITREOUS_EVENT_SCHEMA_VERSION = 1;

export type VitreousEventSchemaVersion = typeof VITREOUS_EVENT_SCHEMA_VERSION;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type VitreousRunStatus = "idle" | "running" | "completed" | "failed";

export type VitreousEventType =
  | "run.started"
  | "source.added"
  | "decision.made"
  | "conflict.detected"
  | "conflict.resolved"
  | "action.requested"
  | "action.resolved"
  | "branch.forked"
  | "branch.switched"
  | "run.completed"
  | "run.failed";

export type VitreousEventBase<
  TType extends VitreousEventType,
  TPayload extends Readonly<Record<string, unknown>>
> = Readonly<{
  id: string;
  schemaVersion: VitreousEventSchemaVersion;
  type: TType;
  runId: string;
  branchId?: BranchId;
  timestamp: IsoDateTime;
  payload: TPayload;
}>;

export type RunStartedPayload =
  Readonly<{
    rootBranchId?: BranchId;
    title?: string;
    userId?: string;
    metadata?: JsonObject;
  }>;

export type SourceAddedPayload =
  Readonly<{
    nodeId?: NodeId;
    parentIds?: ReadonlyArray<NodeId>;
    source: AddNodeInput extends infer T
      ? T extends { type: "citation"; source: infer S }
        ? S
        : never
      : never;
    excerpt?: string;
    contentHash?: string;
    tags?: ReadonlyArray<string>;
  }>;

export type DecisionMadePayload =
  Readonly<{
    nodeId?: NodeId;
    parentIds?: ReadonlyArray<NodeId>;
    claim: string;
    confidence: number;
    provenance: ReadonlyArray<NodeId>;
    rationale?: string;
    alternatives?: AddNodeInput extends infer T
      ? T extends { type: "decision"; alternatives?: infer A }
        ? A
        : never
      : never;
  }>;

export type ConflictDetectedPayload =
  Readonly<{
    nodeId?: NodeId;
    parentIds?: ReadonlyArray<NodeId>;
    contenders: ReadonlyArray<NodeId>;
    description?: string;
  }>;

export type ConflictResolvedPayload =
  Readonly<{
    conflictNodeId: NodeId;
    chosenNodeId: NodeId;
    note?: string;
    resolvedAt?: IsoDateTime;
  }>;

export type ActionRequestedPayload =
  Readonly<{
    nodeId?: NodeId;
    parentIds?: ReadonlyArray<NodeId>;
    action: Readonly<{
      kind: string;
      payload: JsonValue;
      summary: string;
      explanation?: string;
    }>;
    gate?: ExecutionNode["gate"];
  }>;

export type ActionResolvedPayload =
  Readonly<{
    executionNodeId: NodeId;
    status: ExecutionGateStatus;
    decidedAt?: IsoDateTime;
    decidedBy?: "user" | "system";
    reason?: string;
  }>;

export type BranchForkedPayload =
  Readonly<{
    nodeId: NodeId;
    fromBranchId?: BranchId;
    branchId?: BranchId;
    name?: string;
    steering?: ForkSteering;
  }>;

export type BranchSwitchedPayload =
  Readonly<{
    branchId: BranchId;
  }>;

export type RunCompletedPayload =
  Readonly<{
    summary?: string;
    metadata?: JsonObject;
  }>;

export type RunFailedPayload =
  Readonly<{
    message: string;
    code?: string;
    recoverable?: boolean;
    metadata?: JsonObject;
  }>;

export type RunStartedEvent = VitreousEventBase<"run.started", RunStartedPayload>;
export type SourceAddedEvent = VitreousEventBase<"source.added", SourceAddedPayload>;
export type DecisionMadeEvent = VitreousEventBase<"decision.made", DecisionMadePayload>;
export type ConflictDetectedEvent = VitreousEventBase<"conflict.detected", ConflictDetectedPayload>;
export type ConflictResolvedEvent = VitreousEventBase<"conflict.resolved", ConflictResolvedPayload>;
export type ActionRequestedEvent = VitreousEventBase<"action.requested", ActionRequestedPayload>;
export type ActionResolvedEvent = VitreousEventBase<"action.resolved", ActionResolvedPayload>;
export type BranchForkedEvent = VitreousEventBase<"branch.forked", BranchForkedPayload>;
export type BranchSwitchedEvent = VitreousEventBase<"branch.switched", BranchSwitchedPayload>;
export type RunCompletedEvent = VitreousEventBase<"run.completed", RunCompletedPayload>;
export type RunFailedEvent = VitreousEventBase<"run.failed", RunFailedPayload>;

export type VitreousEvent =
  | RunStartedEvent
  | SourceAddedEvent
  | DecisionMadeEvent
  | ConflictDetectedEvent
  | ConflictResolvedEvent
  | ActionRequestedEvent
  | ActionResolvedEvent
  | BranchForkedEvent
  | BranchSwitchedEvent
  | RunCompletedEvent
  | RunFailedEvent;

export type VitreousEventInput =
  | Readonly<{ type: "run.started"; branchId?: BranchId; payload?: RunStartedPayload }>
  | Readonly<{ type: "source.added"; branchId?: BranchId; payload: SourceAddedPayload }>
  | Readonly<{ type: "decision.made"; branchId?: BranchId; payload: DecisionMadePayload }>
  | Readonly<{ type: "conflict.detected"; branchId?: BranchId; payload: ConflictDetectedPayload }>
  | Readonly<{ type: "conflict.resolved"; branchId?: BranchId; payload: ConflictResolvedPayload }>
  | Readonly<{ type: "action.requested"; branchId?: BranchId; payload: ActionRequestedPayload }>
  | Readonly<{ type: "action.resolved"; branchId?: BranchId; payload: ActionResolvedPayload }>
  | Readonly<{ type: "branch.forked"; branchId?: BranchId; payload: BranchForkedPayload }>
  | Readonly<{ type: "branch.switched"; branchId?: BranchId; payload: BranchSwitchedPayload }>
  | Readonly<{ type: "run.completed"; branchId?: BranchId; payload?: RunCompletedPayload }>
  | Readonly<{ type: "run.failed"; branchId?: BranchId; payload: RunFailedPayload }>;

export type VitreousEventFactoryOptions = Readonly<{
  runId: string;
  now?: () => IsoDateTime;
  nextEventId?: () => string;
}>;

const nowIso = (): IsoDateTime => new Date().toISOString();

export function createVitreousEvent(
  input: VitreousEventInput,
  options: VitreousEventFactoryOptions
): VitreousEvent {
  const timestamp = options.now ? options.now() : nowIso();
  const id = options.nextEventId ? options.nextEventId() : `event-${timestamp}-${input.type}`;
  const payload = input.payload ?? {};

  return {
    id,
    schemaVersion: VITREOUS_EVENT_SCHEMA_VERSION,
    type: input.type,
    runId: options.runId,
    branchId: input.branchId,
    timestamp,
    payload
  } as VitreousEvent;
}

export function eventToAddNodeInput(event: SourceAddedEvent): AddNodeInput;
export function eventToAddNodeInput(event: DecisionMadeEvent): AddNodeInput;
export function eventToAddNodeInput(event: ConflictDetectedEvent): AddNodeInput;
export function eventToAddNodeInput(event: ActionRequestedEvent): AddNodeInput;
export function eventToAddNodeInput(
  event: SourceAddedEvent | DecisionMadeEvent | ConflictDetectedEvent | ActionRequestedEvent
): AddNodeInput;
export function eventToAddNodeInput(
  event: SourceAddedEvent | DecisionMadeEvent | ConflictDetectedEvent | ActionRequestedEvent
): AddNodeInput {
  if (event.type === "source.added") {
    return {
      type: "citation",
      id: event.payload.nodeId,
      branchId: event.branchId,
      parentIds: event.payload.parentIds,
      source: event.payload.source,
      excerpt: event.payload.excerpt,
      contentHash: event.payload.contentHash,
      tags: event.payload.tags
    };
  }

  if (event.type === "decision.made") {
    return {
      type: "decision",
      id: event.payload.nodeId,
      branchId: event.branchId,
      parentIds: event.payload.parentIds,
      claim: event.payload.claim,
      confidence: event.payload.confidence,
      provenance: event.payload.provenance,
      rationale: event.payload.rationale,
      alternatives: event.payload.alternatives
    };
  }

  if (event.type === "conflict.detected") {
    return {
      type: "conflict",
      id: event.payload.nodeId,
      branchId: event.branchId,
      parentIds: event.payload.parentIds,
      contenders: event.payload.contenders,
      description: event.payload.description
    };
  }

  return {
    type: "execution",
    id: event.payload.nodeId,
    branchId: event.branchId,
    parentIds: event.payload.parentIds,
    action: event.payload.action,
    gate: event.payload.gate
  };
}

export function eventToForkInput(event: BranchForkedEvent): ForkAtNodeInput {
  return {
    nodeId: event.payload.nodeId,
    branchId: event.payload.branchId,
    fromBranchId: event.payload.fromBranchId,
    name: event.payload.name,
    steering: event.payload.steering
  };
}

export function eventToConflictResolutionInput(
  event: ActionResolvedEvent
): UpdateExecutionGateInput {
  return {
    executionNodeId: event.payload.executionNodeId,
    status: event.payload.status,
    decidedAt: event.payload.decidedAt,
    decidedBy: event.payload.decidedBy,
    reason: event.payload.reason
  };
}

export function eventToResolveConflictInput(event: ConflictResolvedEvent): ResolveConflictInput {
  return {
    conflictNodeId: event.payload.conflictNodeId,
    chosenNodeId: event.payload.chosenNodeId,
    note: event.payload.note,
    resolvedAt: event.payload.resolvedAt
  };
}
