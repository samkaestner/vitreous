import type {
  AddNodeInput,
  BranchMeta,
  ForkAtNodeInput,
  ResolveConflictInput,
  ThoughtEdge,
  ThoughtTreeIdFactory,
  ThoughtTreeState,
  UpdateExecutionGateInput,
  UseThoughtTreeAPI
} from "./thought-tree.js";
import type {
  BranchId,
  ConflictNode,
  ExecutionNode,
  IsoDateTime,
  NodeId,
  ThoughtNode,
  ThoughtNodeType
} from "./nodes.js";

type ManagerOptions = Readonly<{
  idFactory?: ThoughtTreeIdFactory;
  now?: () => IsoDateTime;
}>;

const nowIso = (): IsoDateTime => new Date().toISOString();

function toSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueId(base: string, usedIds: ReadonlySet<string>): string {
  if (!usedIds.has(base)) {
    return base;
  }
  let idx = 2;
  while (usedIds.has(`${base}-${idx}`)) {
    idx += 1;
  }
  return `${base}-${idx}`;
}

export function createDeterministicIdFactory(
  seed: Readonly<{ nodeCounter?: number; branchCounter?: number }> = {}
): ThoughtTreeIdFactory {
  let nodeCounter = seed.nodeCounter ?? 0;
  let branchCounter = seed.branchCounter ?? 0;

  return {
    nextNodeId: (input) => {
      nodeCounter += 1;
      return `node-${nodeCounter}-${toSlug(input.type)}-${toSlug(input.branchId)}`;
    },
    nextBranchId: (input) => {
      branchCounter += 1;
      const parentSlug = input.parentBranchId ? toSlug(input.parentBranchId) : "root";
      return `branch-${branchCounter}-from-${toSlug(input.forkAtNodeId)}-${parentSlug}`;
    }
  };
}

function assertBranchExists(state: ThoughtTreeState, branchId: BranchId): BranchMeta {
  const branch = state.branchesById[branchId];
  if (!branch) {
    throw new Error(`[Vitreous] Branch "${branchId}" does not exist.`);
  }
  return branch;
}

function assertNodeExists(state: ThoughtTreeState, nodeId: NodeId): ThoughtNode {
  const node = state.nodesById[nodeId];
  if (!node) {
    throw new Error(`[Vitreous] Node "${nodeId}" does not exist.`);
  }
  return node;
}

function getNextTimestamp(options: ManagerOptions): IsoDateTime {
  return options.now ? options.now() : nowIso();
}

function getUsedNodeIds(state: ThoughtTreeState): ReadonlySet<string> {
  return new Set(Object.keys(state.nodesById));
}

function getUsedBranchIds(state: ThoughtTreeState): ReadonlySet<string> {
  return new Set(Object.keys(state.branchesById));
}

function buildThoughtNode(
  input: AddNodeInput,
  nodeId: NodeId,
  branchId: BranchId,
  createdAt: IsoDateTime,
  parentIds: ReadonlyArray<NodeId>
): ThoughtNode {
  if (input.type === "citation") {
    return {
      id: nodeId,
      type: "citation",
      createdAt,
      branchId,
      parents: parentIds,
      source: input.source,
      excerpt: input.excerpt,
      contentHash: input.contentHash,
      tags: input.tags
    };
  }

  if (input.type === "decision") {
    return {
      id: nodeId,
      type: "decision",
      createdAt,
      branchId,
      parents: parentIds,
      claim: input.claim,
      confidence: input.confidence,
      provenance: input.provenance,
      rationale: input.rationale,
      alternatives: input.alternatives
    };
  }

  if (input.type === "execution") {
    return {
      id: nodeId,
      type: "execution",
      createdAt,
      branchId,
      parents: parentIds,
      action: input.action,
      gate: input.gate ?? { status: "pending" }
    };
  }

  return {
    id: nodeId,
    type: "conflict",
    createdAt,
    branchId,
    parents: parentIds,
    contenders: input.contenders,
    description: input.description
  };
}

function dedupeEdges(edges: ReadonlyArray<ThoughtEdge>): ReadonlyArray<ThoughtEdge> {
  const used = new Set<string>();
  const result: ThoughtEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    if (!used.has(key)) {
      used.add(key);
      result.push(edge);
    }
  }
  return result;
}

export function addNodeToThoughtTree(
  state: ThoughtTreeState,
  input: AddNodeInput,
  options: ManagerOptions = {}
): ThoughtTreeState {
  const branchId = input.branchId ?? state.activeBranchId;
  const branch = assertBranchExists(state, branchId);
  const parentIds = input.parentIds ?? [];
  for (const parentId of parentIds) {
    assertNodeExists(state, parentId);
  }

  if (input.type === "decision") {
    if (input.confidence < 0 || input.confidence > 1) {
      throw new Error("[Vitreous] Decision confidence must be within [0..1].");
    }
    for (const provenanceId of input.provenance) {
      assertNodeExists(state, provenanceId);
    }
  }

  if (input.type === "conflict" && input.contenders.length < 2) {
    throw new Error("[Vitreous] Conflict node requires at least two contenders.");
  }

  if (input.type === "conflict") {
    for (const contender of input.contenders) {
      assertNodeExists(state, contender);
    }
  }

  const createdAt = getNextTimestamp(options);
  const factory = options.idFactory ?? createDeterministicIdFactory();
  const usedNodeIds = getUsedNodeIds(state);
  if (input.id && usedNodeIds.has(input.id)) {
    throw new Error(`[Vitreous] Node "${input.id}" already exists.`);
  }
  const rawNodeId = input.id ?? factory.nextNodeId({ type: input.type, branchId });
  const nodeId = input.id ?? uniqueId(rawNodeId, usedNodeIds);
  const node = buildThoughtNode(input, nodeId, branchId, createdAt, parentIds);

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [nodeId]: node
    },
    edges: dedupeEdges([
      ...state.edges,
      ...parentIds.map((parentId) => ({ from: parentId, to: nodeId }))
    ]),
    branchesById: {
      ...state.branchesById,
      [branchId]: {
        ...branch,
        timeline: [...branch.timeline, nodeId]
      }
    },
    revision: state.revision + 1,
    updatedAt: createdAt
  };
}

export function forkThoughtTreeAtNode(
  state: ThoughtTreeState,
  input: ForkAtNodeInput,
  options: ManagerOptions = {}
): ThoughtTreeState {
  const fromBranchId = input.fromBranchId ?? state.activeBranchId;
  const fromBranch = assertBranchExists(state, fromBranchId);
  const forkNode = assertNodeExists(state, input.nodeId);
  const forkIndex = fromBranch.timeline.indexOf(input.nodeId);

  if (forkIndex < 0) {
    throw new Error(
      `[Vitreous] Cannot fork at "${input.nodeId}" because it is not present in branch "${fromBranchId}".`
    );
  }

  const createdAt = getNextTimestamp(options);
  const factory = options.idFactory ?? createDeterministicIdFactory();
  const usedBranchIds = getUsedBranchIds(state);
  if (input.branchId && usedBranchIds.has(input.branchId)) {
    throw new Error(`[Vitreous] Branch "${input.branchId}" already exists.`);
  }
  const rawBranchId = factory.nextBranchId({
    parentBranchId: fromBranchId,
    forkAtNodeId: forkNode.id
  });
  const newBranchId = input.branchId ?? uniqueId(rawBranchId, usedBranchIds);

  const nextBranch: BranchMeta = {
    id: newBranchId,
    name: input.name,
    createdAt,
    forkedFromNodeId: input.nodeId,
    parentBranchId: fromBranchId,
    timeline: fromBranch.timeline.slice(0, forkIndex + 1),
    steering: input.steering
  };

  return {
    ...state,
    branchesById: {
      ...state.branchesById,
      [newBranchId]: nextBranch
    },
    activeBranchId: newBranchId,
    revision: state.revision + 1,
    updatedAt: createdAt
  };
}

export function resolveConflictNode(
  state: ThoughtTreeState,
  input: ResolveConflictInput,
  options: ManagerOptions = {}
): ThoughtTreeState {
  const current = assertNodeExists(state, input.conflictNodeId);
  if (current.type !== "conflict") {
    throw new Error(`[Vitreous] Node "${input.conflictNodeId}" is not a conflict node.`);
  }
  if (!current.contenders.includes(input.chosenNodeId)) {
    throw new Error(
      `[Vitreous] Chosen node "${input.chosenNodeId}" is not listed as a contender for conflict "${input.conflictNodeId}".`
    );
  }

  const resolvedAt = input.resolvedAt ?? getNextTimestamp(options);
  const nextConflict: ConflictNode = {
    ...current,
    resolution: {
      chosen: input.chosenNodeId,
      resolvedAt,
      note: input.note
    }
  };

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [input.conflictNodeId]: nextConflict
    },
    revision: state.revision + 1,
    updatedAt: resolvedAt
  };
}

export function updateExecutionGate(
  state: ThoughtTreeState,
  input: UpdateExecutionGateInput,
  options: ManagerOptions = {}
): ThoughtTreeState {
  const current = assertNodeExists(state, input.executionNodeId);
  if (current.type !== "execution") {
    throw new Error(`[Vitreous] Node "${input.executionNodeId}" is not an execution node.`);
  }

  const decidedAt = input.decidedAt ?? getNextTimestamp(options);
  const nextExecution: ExecutionNode = {
    ...current,
    gate: {
      status: input.status,
      decidedAt,
      decidedBy: input.decidedBy,
      reason: input.reason
    }
  };

  return {
    ...state,
    nodesById: {
      ...state.nodesById,
      [input.executionNodeId]: nextExecution
    },
    revision: state.revision + 1,
    updatedAt: decidedAt
  };
}

export function switchThoughtTreeBranch(
  state: ThoughtTreeState,
  branchId: BranchId,
  options: ManagerOptions = {}
): ThoughtTreeState {
  assertBranchExists(state, branchId);
  return {
    ...state,
    activeBranchId: branchId,
    revision: state.revision + 1,
    updatedAt: getNextTimestamp(options)
  };
}

function assertAcyclicNodes(nodesById: Readonly<Record<NodeId, ThoughtNode>>): void {
  const visiting = new Set<NodeId>();
  const visited = new Set<NodeId>();

  const visit = (nodeId: NodeId) => {
    if (visited.has(nodeId)) {
      return;
    }
    if (visiting.has(nodeId)) {
      throw new Error(`[Vitreous] Cycle detected at node "${nodeId}". ThoughtTree must remain acyclic.`);
    }

    visiting.add(nodeId);
    const node = nodesById[nodeId];
    for (const parentId of node.parents) {
      if (!nodesById[parentId]) {
        throw new Error(`[Vitreous] Node "${nodeId}" references missing parent "${parentId}".`);
      }
      visit(parentId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of Object.keys(nodesById)) {
    visit(nodeId);
  }
}

export function validateThoughtTreeState(state: ThoughtTreeState): void {
  assertBranchExists(state, state.rootBranchId);
  assertBranchExists(state, state.activeBranchId);

  const nodeIds = new Set(Object.keys(state.nodesById));
  const branchIds = new Set(Object.keys(state.branchesById));

  for (const [branchId, branch] of Object.entries(state.branchesById)) {
    if (branch.parentBranchId && !branchIds.has(branch.parentBranchId)) {
      throw new Error(
        `[Vitreous] Branch "${branchId}" references missing parent branch "${branch.parentBranchId}".`
      );
    }
    if (branch.forkedFromNodeId && !nodeIds.has(branch.forkedFromNodeId)) {
      throw new Error(
        `[Vitreous] Branch "${branchId}" references missing fork node "${branch.forkedFromNodeId}".`
      );
    }

    for (const timelineNodeId of branch.timeline) {
      if (!nodeIds.has(timelineNodeId)) {
        throw new Error(
          `[Vitreous] Branch "${branchId}" timeline references missing node "${timelineNodeId}".`
        );
      }
    }
  }

  for (const edge of state.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(
        `[Vitreous] Edge "${edge.from}->${edge.to}" references one or more missing nodes.`
      );
    }
  }

  assertAcyclicNodes(state.nodesById);
}

export function createThoughtTreeStateManager(
  initialState: ThoughtTreeState,
  options: ManagerOptions = {}
): UseThoughtTreeAPI {
  validateThoughtTreeState(initialState);
  let state = initialState;
  const managerOptions: ManagerOptions = {
    ...options,
    idFactory:
      options.idFactory ??
      createDeterministicIdFactory({
        nodeCounter: Object.keys(initialState.nodesById).length,
        branchCounter: Object.keys(initialState.branchesById).length
      })
  };

  const manager: UseThoughtTreeAPI = {
    get state() {
      return state;
    },
    addNode: (input) => {
      state = addNodeToThoughtTree(state, input, managerOptions);
      validateThoughtTreeState(state);
      return state;
    },
    forkAtNode: (input) => {
      state = forkThoughtTreeAtNode(state, input, managerOptions);
      validateThoughtTreeState(state);
      return state;
    },
    resolveConflict: (input) => {
      state = resolveConflictNode(state, input, managerOptions);
      validateThoughtTreeState(state);
      return state;
    },
    updateExecutionGate: (input) => {
      state = updateExecutionGate(state, input, managerOptions);
      validateThoughtTreeState(state);
      return state;
    },
    switchBranch: (branchId) => {
      state = switchThoughtTreeBranch(state, branchId, managerOptions);
      validateThoughtTreeState(state);
      return state;
    },
    getNode: (nodeId) => state.nodesById[nodeId],
    getActiveBranch: () => assertBranchExists(state, state.activeBranchId),
    getBranchTimeline: (branchId) => {
      const branch = assertBranchExists(state, branchId ?? state.activeBranchId);
      return branch.timeline
        .map((nodeId) => state.nodesById[nodeId])
        .filter((node): node is ThoughtNode => Boolean(node));
    }
  };

  return manager;
}

export function createEmptyThoughtTreeState(
  rootBranchId: BranchId = "branch-main",
  timestamp: IsoDateTime = nowIso()
): ThoughtTreeState {
  return {
    nodesById: {},
    edges: [],
    branchesById: {
      [rootBranchId]: {
        id: rootBranchId,
        createdAt: timestamp,
        timeline: []
      }
    },
    rootBranchId,
    activeBranchId: rootBranchId,
    revision: 0,
    updatedAt: timestamp
  };
}

export function listNodeIdsByType(
  state: ThoughtTreeState,
  type: ThoughtNodeType
): ReadonlyArray<NodeId> {
  return Object.values(state.nodesById)
    .filter((node) => node.type === type)
    .map((node) => node.id);
}
