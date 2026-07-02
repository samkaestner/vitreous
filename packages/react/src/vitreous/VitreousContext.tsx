"use client";

import * as React from "react";
import type {
  AddNodeInput,
  BranchId,
  VitreousEvent,
  ForkAtNodeInput,
  VitreousMutationResult,
  VitreousPersistenceAdapter,
  VitreousPrivacyHooks,
  VitreousRunAPI,
  VitreousSerializedRun,
  ResolveConflictInput,
  ThoughtNode,
  ThoughtTreeState,
  UpdateExecutionGateInput
} from "@vitreous/core";
import {
  applyEventRedaction,
  createVitreousRun,
  replayVitreousEvents
} from "@vitreous/core";
import { ThoughtTreeContext } from "../thought-tree/ThoughtTreeContext.js";

export type VitreousThemeConfig = Readonly<{
  mode?: "dark" | "light" | "system";
  accent?: string;
}>;

export type VitreousProviderProps = Readonly<{
  children: React.ReactNode;
  runId?: string;
  title?: string;
  userId?: string;
  initialState?: ThoughtTreeState;
  initialEvents?: ReadonlyArray<VitreousEvent>;
  persistence?: VitreousPersistenceAdapter;
  privacy?: VitreousPrivacyHooks;
  theme?: VitreousThemeConfig;
}>;

export type VitreousContextValue = VitreousRunAPI &
  Readonly<{
    theme?: VitreousThemeConfig;
    privacy?: VitreousPrivacyHooks;
    snapshot: VitreousSerializedRun;
  }>;

const VitreousContext = React.createContext<VitreousContextValue | null>(null);

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return Boolean(value && typeof (value as Promise<T>).then === "function");
}

function serializeForPersistence(
  snapshot: VitreousSerializedRun,
  privacy?: VitreousPrivacyHooks
): VitreousSerializedRun {
  if (!privacy?.redactEvent) {
    return snapshot;
  }
  const events = snapshot.events
    .map((event) => applyEventRedaction(event, privacy))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  try {
    return {
      ...replayVitreousEvents(events),
      runId: snapshot.runId
    };
  } catch {
    return {
      ...snapshot,
      events
    };
  }
}

function createRunFromProps(props: VitreousProviderProps): VitreousRunAPI {
  const loaded = props.persistence?.load(props.runId);
  if (loaded && !isPromiseLike(loaded)) {
    return createVitreousRun({ runId: props.runId, events: loaded.events });
  }

  return createVitreousRun({
    runId: props.runId,
    title: props.title,
    userId: props.userId,
    state: props.initialState,
    events: props.initialEvents
  });
}

export function VitreousProvider(props: VitreousProviderProps) {
  const { children, persistence, privacy, theme, runId } = props;
  const runRef = React.useRef<VitreousRunAPI | null>(null);

  if (!runRef.current) {
    runRef.current = createRunFromProps(props);
  }

  const [snapshot, setSnapshot] = React.useState(() => runRef.current!.serialize());

  const persistSnapshot = React.useCallback(
    (nextSnapshot: VitreousSerializedRun) => {
      if (!persistence) {
        return;
      }
      const maybeSave = persistence.save(serializeForPersistence(nextSnapshot, privacy));
      if (isPromiseLike(maybeSave)) {
        void maybeSave.catch((error) => {
          console.error("[Vitreous] Failed to persist run.", error);
        });
      }
    },
    [persistence, privacy]
  );

  const commit = React.useCallback(
    <T,>(execute: (run: VitreousRunAPI) => T): T => {
      const run = runRef.current;
      if (!run) {
        throw new Error("[Vitreous] Vitreous run is not initialized.");
      }
      const result = execute(run);
      const nextSnapshot = run.serialize();
      setSnapshot(nextSnapshot);
      persistSnapshot(nextSnapshot);
      return result;
    },
    [persistSnapshot]
  );

  React.useEffect(() => {
    const loaded = persistence?.load(runId);
    if (!loaded || !isPromiseLike(loaded)) {
      return;
    }
    let cancelled = false;
    void loaded
      .then((serialized) => {
        if (cancelled || !serialized) {
          return;
        }
        runRef.current = createVitreousRun({
          runId: serialized.runId,
          events: serialized.events
        });
        setSnapshot(runRef.current.serialize());
      })
      .catch((error) => {
        console.error("[Vitreous] Failed to load persisted run.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [persistence, runId]);

  const api = React.useMemo<VitreousContextValue>(() => {
    const run = runRef.current;
    if (!run) {
      throw new Error("[Vitreous] Vitreous run is not initialized.");
    }

    return {
      get runId() {
        return run.runId;
      },
      get state() {
        return snapshot.state;
      },
      get events() {
        return snapshot.events;
      },
      get status() {
        return snapshot.status;
      },
      snapshot,
      theme,
      privacy,
      addNode: (input: AddNodeInput) => commit((current) => current.addNode(input)),
      forkAtNode: (input: ForkAtNodeInput) => commit((current) => current.forkAtNode(input)),
      resolveConflict: (input: ResolveConflictInput) =>
        commit((current) => current.resolveConflict(input)),
      updateExecutionGate: (input: UpdateExecutionGateInput) =>
        commit((current) => current.updateExecutionGate(input)),
      switchBranch: (branchId: BranchId) => commit((current) => current.switchBranch(branchId)),
      getNode: (nodeId) => snapshot.state.nodesById[nodeId],
      getActiveBranch: () => snapshot.state.branchesById[snapshot.state.activeBranchId],
      getBranchTimeline: (branchId?: BranchId) => {
        const branch = snapshot.state.branchesById[branchId ?? snapshot.state.activeBranchId];
        return branch.timeline
          .map((nodeId) => snapshot.state.nodesById[nodeId])
          .filter((node): node is ThoughtNode => Boolean(node));
      },
      ingestEvent: (event) => commit((current) => current.ingestEvent(event)),
      recordSource: (input) => commit((current) => current.recordSource(input)),
      recordDecision: (input) => commit((current) => current.recordDecision(input)),
      recordConflict: (input) => commit((current) => current.recordConflict(input)),
      resolveRecordedConflict: (input) =>
        commit((current) => current.resolveRecordedConflict(input)),
      requestActionApproval: (input) =>
        commit((current) => current.requestActionApproval(input)),
      resolveActionApproval: (input) =>
        commit((current) => current.resolveActionApproval(input)),
      forkFromDecision: (input) => commit((current) => current.forkFromDecision(input)),
      completeRun: (input) => commit((current) => current.completeRun(input)),
      failRun: (input) => commit((current) => current.failRun(input)),
      serialize: () => snapshot
    };
  }, [commit, privacy, snapshot, theme]);

  return (
    <VitreousContext.Provider value={api}>
      <ThoughtTreeContext.Provider value={api}>{children}</ThoughtTreeContext.Provider>
    </VitreousContext.Provider>
  );
}

export function useVitreous(): VitreousContextValue {
  const context = React.useContext(VitreousContext);
  if (!context) {
    throw new Error("[Vitreous] useVitreous must be used within <VitreousProvider>.");
  }
  return context;
}

export function useVitreousRun(runId?: string): VitreousContextValue {
  const context = useVitreous();
  if (runId && context.runId !== runId) {
    throw new Error(
      `[Vitreous] Requested run "${runId}" but the active provider is scoped to "${context.runId}".`
    );
  }
  return context;
}
