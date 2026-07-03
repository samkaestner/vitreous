import type {
  AddNodeInput,
  ForkAtNodeInput,
  ResolveConflictInput,
  ThoughtTreeIdFactory,
  ThoughtTreeState,
  UpdateExecutionGateInput,
  UseThoughtTreeAPI
} from "./thought-tree.js";
import type { BranchId, IsoDateTime, NodeId } from "./nodes.js";
import {
  createDeterministicIdFactory,
  createEmptyThoughtTreeState,
  createThoughtTreeStateManager,
  validateThoughtTreeState
} from "./state-manager.js";
import {
  createVitreousEvent,
  eventToAddNodeInput,
  eventToConflictResolutionInput,
  eventToForkInput,
  eventToResolveConflictInput,
  VITREOUS_EVENT_SCHEMA_VERSION,
  type ActionRequestedPayload,
  type ActionResolvedPayload,
  type BranchForkedPayload,
  type BranchSwitchedPayload,
  type ConflictDetectedPayload,
  type ConflictResolvedPayload,
  type DecisionMadePayload,
  type VitreousEvent,
  type VitreousEventInput,
  type VitreousRunStatus,
  type JsonObject,
  type RunCompletedPayload,
  type RunFailedPayload,
  type RunStartedPayload,
  type SourceAddedPayload
} from "./events.js";

export type VitreousRunIdFactory = Readonly<{
  nextRunId: () => string;
  nextEventId: () => string;
}>;

export type VitreousRunOptions = Readonly<{
  idFactory?: ThoughtTreeIdFactory;
  runIdFactory?: VitreousRunIdFactory;
  now?: () => IsoDateTime;
}>;

export type CreateVitreousRunInput = Readonly<{
  runId?: string;
  title?: string;
  userId?: string;
  rootBranchId?: BranchId;
  metadata?: JsonObject;
  events?: ReadonlyArray<VitreousEvent>;
  state?: ThoughtTreeState;
  skipStartEvent?: boolean;
}>;

export type VitreousSerializedRun = Readonly<{
  schemaVersion: typeof VITREOUS_EVENT_SCHEMA_VERSION;
  runId: string;
  status: VitreousRunStatus;
  state: ThoughtTreeState;
  events: ReadonlyArray<VitreousEvent>;
}>;

export type MaybePromise<T> = T | Promise<T>;

export type VitreousPersistenceAdapter = Readonly<{
  load: (runId?: string) => MaybePromise<VitreousSerializedRun | null>;
  save: (run: VitreousSerializedRun) => MaybePromise<void>;
  clear?: (runId?: string) => MaybePromise<void>;
}>;

export type VitreousMutationResult = Readonly<{
  event: VitreousEvent;
  state: ThoughtTreeState;
  nodeId?: NodeId;
  branchId?: BranchId;
}>;

export type VitreousRunAPI = UseThoughtTreeAPI &
  Readonly<{
    readonly runId: string;
    readonly events: ReadonlyArray<VitreousEvent>;
    readonly status: VitreousRunStatus;
    ingestEvent: (event: VitreousEvent) => VitreousMutationResult;
    recordSource: (input: SourceAddedPayload & Readonly<{ branchId?: BranchId }>) => VitreousMutationResult;
    recordDecision: (input: DecisionMadePayload & Readonly<{ branchId?: BranchId }>) => VitreousMutationResult;
    recordConflict: (input: ConflictDetectedPayload & Readonly<{ branchId?: BranchId }>) => VitreousMutationResult;
    resolveRecordedConflict: (
      input: ConflictResolvedPayload & Readonly<{ branchId?: BranchId }>
    ) => VitreousMutationResult;
    requestActionApproval: (
      input: ActionRequestedPayload & Readonly<{ branchId?: BranchId }>
    ) => VitreousMutationResult;
    resolveActionApproval: (
      input: ActionResolvedPayload & Readonly<{ branchId?: BranchId }>
    ) => VitreousMutationResult;
    forkFromDecision: (input: BranchForkedPayload) => VitreousMutationResult;
    completeRun: (input?: RunCompletedPayload) => VitreousMutationResult;
    failRun: (input: RunFailedPayload) => VitreousMutationResult;
    serialize: () => VitreousSerializedRun;
  }>;

const nowIso = (): IsoDateTime => new Date().toISOString();

export function createVitreousRunIdFactory(
  seed: Readonly<{ runCounter?: number; eventCounter?: number }> = {}
): VitreousRunIdFactory {
  let runCounter = seed.runCounter ?? 0;
  let eventCounter = seed.eventCounter ?? 0;

  return {
    nextRunId: () => {
      runCounter += 1;
      return `run-${runCounter}`;
    },
    nextEventId: () => {
      eventCounter += 1;
      return `event-${eventCounter}`;
    }
  };
}

function getLastTimelineNodeId(state: ThoughtTreeState, branchId: BranchId): NodeId | undefined {
  const timeline = state.branchesById[branchId]?.timeline;
  return timeline ? timeline[timeline.length - 1] : undefined;
}

function getReplayRootBranchId(events: ReadonlyArray<VitreousEvent>): BranchId {
  const started = events.find((event) => event.type === "run.started");
  return started?.payload.rootBranchId ?? "branch-main";
}

function getReplayRunId(events: ReadonlyArray<VitreousEvent>): string {
  return events[0]?.runId ?? "run-replay";
}

function getStatusAfterEvent(previous: VitreousRunStatus, event: VitreousEvent): VitreousRunStatus {
  if (event.type === "run.started") {
    return "running";
  }
  if (event.type === "run.completed") {
    return "completed";
  }
  if (event.type === "run.failed") {
    return "failed";
  }
  return previous;
}

function withPayloadNodeId<TEvent extends VitreousEvent>(
  event: TEvent,
  nodeId: NodeId | undefined
): TEvent {
  if (!nodeId) {
    return event;
  }
  return {
    ...event,
    payload: {
      ...event.payload,
      nodeId
    }
  } as TEvent;
}

function withPayloadBranchId<TEvent extends VitreousEvent>(
  event: TEvent,
  branchId: BranchId | undefined
): TEvent {
  if (!branchId) {
    return event;
  }
  return {
    ...event,
    payload: {
      ...event.payload,
      branchId
    }
  } as TEvent;
}

function eventInputFor(input: VitreousEventInput): VitreousEventInput {
  return input;
}

export function replayVitreousEvents(
  events: ReadonlyArray<VitreousEvent>,
  options: VitreousRunOptions = {}
): VitreousSerializedRun {
  const state = createEmptyThoughtTreeState(
    getReplayRootBranchId(events),
    events[0]?.timestamp ?? (options.now ? options.now() : nowIso())
  );
  let mutationTimestamp = state.updatedAt;
  const manager = createThoughtTreeStateManager(state, {
    idFactory: options.idFactory,
    now: () => mutationTimestamp
  });
  let status: VitreousRunStatus = "idle";

  for (const event of events) {
    mutationTimestamp = event.timestamp;
    applyEventToManager(manager, event);
    status = getStatusAfterEvent(status, event);
  }

  return {
    schemaVersion: VITREOUS_EVENT_SCHEMA_VERSION,
    runId: getReplayRunId(events),
    status,
    state: manager.state,
    events
  };
}

function applyEventToManager(manager: UseThoughtTreeAPI, event: VitreousEvent): ThoughtTreeState {
  if (
    event.type === "source.added" ||
    event.type === "decision.made" ||
    event.type === "conflict.detected" ||
    event.type === "action.requested"
  ) {
    return manager.addNode(eventToAddNodeInput(event));
  }

  if (event.type === "conflict.resolved") {
    return manager.resolveConflict(eventToResolveConflictInput(event));
  }

  if (event.type === "action.resolved") {
    return manager.updateExecutionGate(eventToConflictResolutionInput(event));
  }

  if (event.type === "branch.forked") {
    return manager.forkAtNode(eventToForkInput(event));
  }

  if (event.type === "branch.switched") {
    return manager.switchBranch(event.payload.branchId);
  }

  validateThoughtTreeState(manager.state);
  return manager.state;
}

export function createVitreousRun(
  input: CreateVitreousRunInput = {},
  options: VitreousRunOptions = {}
): VitreousRunAPI {
  if (!input.skipStartEvent && input.events && input.events.length > 0) {
    const replayed = replayVitreousEvents(input.events, options);
    return createVitreousRun(
      {
        runId: input.runId ?? replayed.runId,
        state: replayed.state,
        events: replayed.events,
        skipStartEvent: true
      },
      options
    );
  }

  const runIdFactory = options.runIdFactory ?? createVitreousRunIdFactory();
  const runId = input.runId ?? runIdFactory.nextRunId();
  const rootBranchId = input.rootBranchId ?? input.state?.rootBranchId ?? "branch-main";
  const initialTimestamp = input.state?.updatedAt ?? (options.now ? options.now() : nowIso());
  let mutationTimestamp = initialTimestamp;
  const manager = createThoughtTreeStateManager(
    input.state ?? createEmptyThoughtTreeState(rootBranchId, initialTimestamp),
    {
      idFactory:
        options.idFactory ??
        createDeterministicIdFactory({
          nodeCounter: Object.keys(input.state?.nodesById ?? {}).length,
          branchCounter: Object.keys(input.state?.branchesById ?? {}).length
        }),
      now: () => mutationTimestamp
    }
  );
  let events: ReadonlyArray<VitreousEvent> = input.events ?? [];
  let status: VitreousRunStatus = events.reduce(getStatusAfterEvent, "idle" as VitreousRunStatus);

  const createEvent = (eventInput: VitreousEventInput) =>
    createVitreousEvent(eventInput, {
      runId,
      now: options.now,
      nextEventId: runIdFactory.nextEventId
    });

  const appendEvent = (event: VitreousEvent, nodeId?: NodeId, branchId?: BranchId): VitreousMutationResult => {
    events = [...events, event];
    status = getStatusAfterEvent(status, event);
    return {
      event,
      state: manager.state,
      nodeId,
      branchId
    };
  };

  const ingestEvent = (event: VitreousEvent): VitreousMutationResult => {
    const beforeActiveBranchId = manager.state.activeBranchId;
    mutationTimestamp = event.timestamp;
    const nextState = applyEventToManager(manager, event);
    const afterActiveBranchId = nextState.activeBranchId;
    const nodeId =
      event.type === "source.added" ||
      event.type === "decision.made" ||
      event.type === "conflict.detected" ||
      event.type === "action.requested"
        ? getLastTimelineNodeId(nextState, event.branchId ?? beforeActiveBranchId)
        : undefined;
    const branchId = event.type === "branch.forked" ? afterActiveBranchId : event.branchId;
    return appendEvent(event, nodeId, branchId);
  };

  const recordAdditiveEvent = (
    eventInput: VitreousEventInput,
    branchId: BranchId
  ): VitreousMutationResult => {
    const provisionalEvent = createEvent(eventInput);
    mutationTimestamp = provisionalEvent.timestamp;
    const nextState = applyEventToManager(manager, provisionalEvent);
    const nodeId = getLastTimelineNodeId(nextState, branchId);
    const event = withPayloadNodeId(provisionalEvent, nodeId);
    return appendEvent(event, nodeId, branchId);
  };

  const api: VitreousRunAPI = {
    get runId() {
      return runId;
    },
    get state() {
      return manager.state;
    },
    get events() {
      return events;
    },
    get status() {
      return status;
    },
    addNode: (nodeInput: AddNodeInput) => {
      const branchId = nodeInput.branchId ?? manager.state.activeBranchId;
      if (nodeInput.type === "citation") {
        return recordAdditiveEvent(
          eventInputFor({
            type: "source.added",
            branchId,
            payload: {
              nodeId: nodeInput.id,
              parentIds: nodeInput.parentIds,
              source: nodeInput.source,
              excerpt: nodeInput.excerpt,
              contentHash: nodeInput.contentHash,
              tags: nodeInput.tags
            }
          }),
          branchId
        ).state;
      }
      if (nodeInput.type === "decision") {
        return recordAdditiveEvent(
          eventInputFor({
            type: "decision.made",
            branchId,
            payload: {
              nodeId: nodeInput.id,
              parentIds: nodeInput.parentIds,
              claim: nodeInput.claim,
              confidence: nodeInput.confidence,
              provenance: nodeInput.provenance,
              rationale: nodeInput.rationale,
              alternatives: nodeInput.alternatives
            }
          }),
          branchId
        ).state;
      }
      if (nodeInput.type === "conflict") {
        return recordAdditiveEvent(
          eventInputFor({
            type: "conflict.detected",
            branchId,
            payload: {
              nodeId: nodeInput.id,
              parentIds: nodeInput.parentIds,
              contenders: nodeInput.contenders,
              description: nodeInput.description
            }
          }),
          branchId
        ).state;
      }
      return recordAdditiveEvent(
        eventInputFor({
          type: "action.requested",
          branchId,
          payload: {
            nodeId: nodeInput.id,
            parentIds: nodeInput.parentIds,
            action: nodeInput.action as ActionRequestedPayload["action"],
            gate: nodeInput.gate
          }
        }),
        branchId
      ).state;
    },
    forkAtNode: (forkInput: ForkAtNodeInput) => {
      const branchId = forkInput.fromBranchId ?? manager.state.activeBranchId;
      const provisionalEvent = createEvent(
        eventInputFor({
          type: "branch.forked",
          branchId,
          payload: {
            nodeId: forkInput.nodeId,
            fromBranchId: forkInput.fromBranchId,
            branchId: forkInput.branchId,
            name: forkInput.name,
            steering: forkInput.steering
          }
        })
      );
      mutationTimestamp = provisionalEvent.timestamp;
      const nextState = applyEventToManager(manager, provisionalEvent);
      const event = withPayloadBranchId(provisionalEvent, nextState.activeBranchId);
      appendEvent(event, undefined, nextState.activeBranchId);
      return manager.state;
    },
    resolveConflict: (resolveInput: ResolveConflictInput) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "conflict.resolved",
          branchId,
          payload: {
            conflictNodeId: resolveInput.conflictNodeId,
            chosenNodeId: resolveInput.chosenNodeId,
            note: resolveInput.note,
            resolvedAt: resolveInput.resolvedAt
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      appendEvent(event, undefined, branchId);
      return manager.state;
    },
    updateExecutionGate: (gateInput: UpdateExecutionGateInput) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "action.resolved",
          branchId,
          payload: {
            executionNodeId: gateInput.executionNodeId,
            status: gateInput.status,
            decidedAt: gateInput.decidedAt,
            decidedBy: gateInput.decidedBy,
            reason: gateInput.reason
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      appendEvent(event, gateInput.executionNodeId, branchId);
      return manager.state;
    },
    switchBranch: (branchId: BranchId) => {
      const event = createEvent(
        eventInputFor({
          type: "branch.switched",
          branchId,
          payload: { branchId }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      appendEvent(event, undefined, branchId);
      return manager.state;
    },
    getNode: (nodeId: NodeId) => manager.getNode(nodeId),
    getActiveBranch: () => manager.getActiveBranch(),
    getBranchTimeline: (branchId?: BranchId) => manager.getBranchTimeline(branchId),
    ingestEvent,
    recordSource: (sourceInput) => {
      const branchId = sourceInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "source.added",
          branchId,
          payload: {
            nodeId: sourceInput.nodeId,
            parentIds: sourceInput.parentIds,
            source: sourceInput.source,
            excerpt: sourceInput.excerpt,
            contentHash: sourceInput.contentHash,
            tags: sourceInput.tags
          }
        }),
        branchId
      );
    },
    recordDecision: (decisionInput) => {
      const branchId = decisionInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "decision.made",
          branchId,
          payload: {
            nodeId: decisionInput.nodeId,
            parentIds: decisionInput.parentIds,
            claim: decisionInput.claim,
            confidence: decisionInput.confidence,
            provenance: decisionInput.provenance,
            rationale: decisionInput.rationale,
            alternatives: decisionInput.alternatives
          }
        }),
        branchId
      );
    },
    recordConflict: (conflictInput) => {
      const branchId = conflictInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "conflict.detected",
          branchId,
          payload: {
            nodeId: conflictInput.nodeId,
            parentIds: conflictInput.parentIds,
            contenders: conflictInput.contenders,
            description: conflictInput.description
          }
        }),
        branchId
      );
    },
    resolveRecordedConflict: (resolveInput) => {
      const branchId = resolveInput.branchId ?? manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "conflict.resolved",
          branchId,
          payload: {
            conflictNodeId: resolveInput.conflictNodeId,
            chosenNodeId: resolveInput.chosenNodeId,
            note: resolveInput.note,
            resolvedAt: resolveInput.resolvedAt
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      return appendEvent(event, undefined, branchId);
    },
    requestActionApproval: (actionInput) => {
      const branchId = actionInput.branchId ?? manager.state.activeBranchId;
      return recordAdditiveEvent(
        eventInputFor({
          type: "action.requested",
          branchId,
          payload: {
            nodeId: actionInput.nodeId,
            parentIds: actionInput.parentIds,
            action: actionInput.action,
            gate: actionInput.gate
          }
        }),
        branchId
      );
    },
    resolveActionApproval: (actionInput) => {
      const branchId = actionInput.branchId ?? manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({
          type: "action.resolved",
          branchId,
          payload: {
            executionNodeId: actionInput.executionNodeId,
            status: actionInput.status,
            decidedAt: actionInput.decidedAt,
            decidedBy: actionInput.decidedBy,
            reason: actionInput.reason
          }
        })
      );
      mutationTimestamp = event.timestamp;
      applyEventToManager(manager, event);
      return appendEvent(event, actionInput.executionNodeId, branchId);
    },
    forkFromDecision: (forkInput) => {
      const branchId = forkInput.fromBranchId ?? manager.state.activeBranchId;
      const provisionalEvent = createEvent(
        eventInputFor({
          type: "branch.forked",
          branchId,
          payload: {
            nodeId: forkInput.nodeId,
            fromBranchId: forkInput.fromBranchId,
            branchId: forkInput.branchId,
            name: forkInput.name,
            steering: forkInput.steering
          }
        })
      );
      mutationTimestamp = provisionalEvent.timestamp;
      const nextState = applyEventToManager(manager, provisionalEvent);
      const event = withPayloadBranchId(provisionalEvent, nextState.activeBranchId);
      return appendEvent(event, undefined, nextState.activeBranchId);
    },
    completeRun: (completeInput = {}) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({ type: "run.completed", branchId, payload: completeInput })
      );
      return appendEvent(event, undefined, branchId);
    },
    failRun: (failInput) => {
      const branchId = manager.state.activeBranchId;
      const event = createEvent(
        eventInputFor({ type: "run.failed", branchId, payload: failInput })
      );
      return appendEvent(event, undefined, branchId);
    },
    serialize: () => ({
      schemaVersion: VITREOUS_EVENT_SCHEMA_VERSION,
      runId,
      status,
      state: manager.state,
      events
    })
  };

  if (!input.skipStartEvent && events.length === 0) {
    const startEvent = createEvent(
      eventInputFor({
        type: "run.started",
        branchId: rootBranchId,
        payload: {
          rootBranchId,
          title: input.title,
          userId: input.userId,
          metadata: input.metadata
        }
      })
    );
    events = [startEvent];
    status = "running";
  }

  return api;
}
