import type {
  BranchId,
  ConflictNode,
  DecisionAlternative,
  ExecutionGateStatus,
  ExecutionNode,
  IsoDateTime,
  NodeId,
  ThoughtNode
} from "./nodes.js";

export type ThoughtEdge = Readonly<{
  from: NodeId;
  to: NodeId;
}>;

export type ForkSteering = Readonly<{
  /** Free-form user instruction for the LLM. */
  prompt?: string;
  /** Identifier of a selected alternative from the source DecisionNode.alternatives, if any. */
  selectedAlternativeId?: string;
}>;

export type BranchMeta = Readonly<{
  id: BranchId;
  name?: string;
  createdAt: IsoDateTime;
  forkedFromNodeId?: NodeId;
  parentBranchId?: BranchId;
  timeline: ReadonlyArray<NodeId>;
  /** Optional steering directive captured at fork time. */
  steering?: ForkSteering;
}>;

export type ThoughtTreeIdFactory = Readonly<{
  nextNodeId: (input: Readonly<{ type: ThoughtNode["type"]; branchId: BranchId }>) => NodeId;
  nextBranchId: (input: Readonly<{ parentBranchId?: BranchId; forkAtNodeId: NodeId }>) => BranchId;
}>;

export type ThoughtTreeState = Readonly<{
  nodesById: Readonly<Record<NodeId, ThoughtNode>>;
  edges: ReadonlyArray<ThoughtEdge>;
  branchesById: Readonly<Record<BranchId, BranchMeta>>;
  rootBranchId: BranchId;
  activeBranchId: BranchId;
  revision: number;
  updatedAt: IsoDateTime;
}>;

export type AddNodeInput =
  | Readonly<{
      type: "citation";
      id?: NodeId;
      branchId?: BranchId;
      parentIds?: ReadonlyArray<NodeId>;
      source: ThoughtNode extends infer T
        ? T extends { type: "citation"; source: infer S }
          ? S
          : never
        : never;
      excerpt?: string;
      contentHash?: string;
      tags?: ReadonlyArray<string>;
    }>
  | Readonly<{
      type: "decision";
      id?: NodeId;
      branchId?: BranchId;
      parentIds?: ReadonlyArray<NodeId>;
      claim: string;
      confidence: number;
      provenance: ReadonlyArray<NodeId>;
      rationale?: string;
      alternatives?: ReadonlyArray<DecisionAlternative>;
    }>
  | Readonly<{
      type: "execution";
      id?: NodeId;
      branchId?: BranchId;
      parentIds?: ReadonlyArray<NodeId>;
      action: ExecutionNode["action"];
      gate?: ExecutionNode["gate"];
    }>
  | Readonly<{
      type: "conflict";
      id?: NodeId;
      branchId?: BranchId;
      parentIds?: ReadonlyArray<NodeId>;
      contenders: ConflictNode["contenders"];
      description?: string;
    }>;

export type ForkAtNodeInput = Readonly<{
  nodeId: NodeId;
  branchId?: BranchId;
  fromBranchId?: BranchId;
  name?: string;
  /** Optional steering directive (free-form prompt and/or selected alternative). */
  steering?: ForkSteering;
}>;

export type ResolveConflictInput = Readonly<{
  conflictNodeId: NodeId;
  chosenNodeId: NodeId;
  note?: string;
  resolvedAt?: IsoDateTime;
}>;

export type UpdateExecutionGateInput = Readonly<{
  executionNodeId: NodeId;
  status: ExecutionGateStatus;
  decidedAt?: IsoDateTime;
  decidedBy?: "user" | "system";
  reason?: string;
}>;

/**
 * Read/write contract for the core ThoughtTree state manager.
 */
export type UseThoughtTreeAPI = Readonly<{
  readonly state: ThoughtTreeState;
  addNode: (input: AddNodeInput) => ThoughtTreeState;
  forkAtNode: (input: ForkAtNodeInput) => ThoughtTreeState;
  resolveConflict: (input: ResolveConflictInput) => ThoughtTreeState;
  updateExecutionGate: (input: UpdateExecutionGateInput) => ThoughtTreeState;
  switchBranch: (branchId: BranchId) => ThoughtTreeState;
  getNode: (nodeId: NodeId) => ThoughtNode | undefined;
  getActiveBranch: () => BranchMeta;
  getBranchTimeline: (branchId?: BranchId) => ReadonlyArray<ThoughtNode>;
}>;
