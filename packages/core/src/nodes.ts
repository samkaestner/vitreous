export type ThoughtNodeType = "citation" | "decision" | "execution" | "conflict";
export type NodeId = string;
export type BranchId = string;
export type IsoDateTime = string;
export type Provenance = ReadonlyArray<NodeId>;

export type ThoughtNodeBase = Readonly<{
  /** Deterministic ID (stable across serialization) */
  id: NodeId;
  /** Node discriminant */
  type: ThoughtNodeType;
  /** ISO timestamp when created */
  createdAt: IsoDateTime;
  /** Branch affinity for DAG traversal and branch timelines */
  branchId: BranchId;
  /** Direct parent pointers in the DAG */
  parents: ReadonlyArray<NodeId>;
}>;

export type CitationNode = ThoughtNodeBase &
  Readonly<{
    type: "citation";
    source: Readonly<{
      kind: "url" | "file" | "memory" | "user";
      uri: string;
      title?: string;
      domain?: string;
    }>;
    excerpt?: string;
    contentHash?: string;
    tags?: ReadonlyArray<string>;
  }>;

export type DecisionAlternative = Readonly<{
  /** Stable identifier for the alternative (deterministic, e.g. "alt-1"). */
  id: string;
  /** Short button-friendly label. */
  label: string;
  /** Optional sentence shown beneath the label in detail surfaces. */
  description?: string;
}>;

export type DecisionNode = ThoughtNodeBase &
  Readonly<{
    type: "decision";
    claim: string;
    /** Confidence score in [0..1] */
    confidence: number;
    provenance: Provenance;
    /** Long-form explanation surfaced in the decision detail modal. */
    rationale?: string;
    /** LLM-suggested alternative directions a user might want to steer toward. */
    alternatives?: ReadonlyArray<DecisionAlternative>;
  }>;

export type ExecutionGateStatus =
  | "pending"
  | "allowed_once"
  | "always_allowed"
  | "rejected";

export type ExecutionNode = ThoughtNodeBase &
  Readonly<{
    type: "execution";
    action: Readonly<{
      kind: string;
      payload: unknown;
      summary: string;
      explanation?: string;
    }>;
    gate: Readonly<{
      status: ExecutionGateStatus;
      decidedAt?: IsoDateTime;
      decidedBy?: "user" | "system";
      reason?: string;
    }>;
  }>;

export type ConflictNode = ThoughtNodeBase &
  Readonly<{
    type: "conflict";
    contenders: ReadonlyArray<NodeId>;
    description?: string;
    resolution?: Readonly<{
      chosen: NodeId;
      resolvedAt: IsoDateTime;
      note?: string;
    }>;
  }>;

export type ThoughtNode =
  | CitationNode
  | DecisionNode
  | ExecutionNode
  | ConflictNode;

