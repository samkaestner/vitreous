"use client";

import * as React from "react";
import type {
  AddNodeInput,
  BranchId,
  ThoughtTreeState,
  UseThoughtTreeAPI
} from "@vitreous/core";
import {
  createDeterministicIdFactory,
  createThoughtTreeStateManager
} from "@vitreous/core";

export const ThoughtTreeContext = React.createContext<UseThoughtTreeAPI | null>(null);

export type ThoughtTreeProviderProps = {
  children: React.ReactNode;
  initialState: ThoughtTreeState;
};

/**
 * Provides the immutable ThoughtTree state + mutation API to descendant components.
 */
export function ThoughtTreeProvider(props: ThoughtTreeProviderProps) {
  const { children, initialState } = props;
  const managerRef = React.useRef<UseThoughtTreeAPI | null>(null);

  if (!managerRef.current) {
    managerRef.current = createThoughtTreeStateManager(initialState, {
      idFactory: createDeterministicIdFactory({
        nodeCounter: Object.keys(initialState.nodesById).length,
        branchCounter: Object.keys(initialState.branchesById).length
      })
    });
  }

  const [state, setState] = React.useState<ThoughtTreeState>(managerRef.current.state);

  const runMutation = React.useCallback(
    (execute: (manager: UseThoughtTreeAPI) => ThoughtTreeState): ThoughtTreeState => {
      const manager = managerRef.current;
      if (!manager) {
        throw new Error("[Vitreous] ThoughtTree manager is not initialized.");
      }
      const nextState = execute(manager);
      setState(nextState);
      return nextState;
    },
    []
  );

  const addNode = React.useCallback(
    (input: AddNodeInput) => {
      return runMutation((manager) => manager.addNode(input));
    },
    [runMutation]
  );

  const forkAtNode = React.useCallback(
    (input: Parameters<UseThoughtTreeAPI["forkAtNode"]>[0]) => {
      return runMutation((manager) => manager.forkAtNode(input));
    },
    [runMutation]
  );

  const resolveConflict = React.useCallback(
    (input: Parameters<UseThoughtTreeAPI["resolveConflict"]>[0]) => {
      return runMutation((manager) => manager.resolveConflict(input));
    },
    [runMutation]
  );

  const updateExecutionGateAction = React.useCallback(
    (input: Parameters<UseThoughtTreeAPI["updateExecutionGate"]>[0]) => {
      return runMutation((manager) => manager.updateExecutionGate(input));
    },
    [runMutation]
  );

  const switchBranch = React.useCallback(
    (branchId: BranchId) => {
      return runMutation((manager) => manager.switchBranch(branchId));
    },
    [runMutation]
  );

  const getNode = React.useCallback((nodeId: Parameters<UseThoughtTreeAPI["getNode"]>[0]) => {
    return managerRef.current?.getNode(nodeId);
  }, []);

  const getActiveBranch = React.useCallback(() => {
    const manager = managerRef.current;
    if (!manager) {
      throw new Error("[Vitreous] ThoughtTree manager is not initialized.");
    }
    return manager.getActiveBranch();
  }, []);

  const getBranchTimeline = React.useCallback((branchId?: BranchId) => {
    const manager = managerRef.current;
    if (!manager) {
      throw new Error("[Vitreous] ThoughtTree manager is not initialized.");
    }
    return manager.getBranchTimeline(branchId);
  }, []);

  const api = React.useMemo<UseThoughtTreeAPI>(
    () => ({
      state,
      addNode,
      forkAtNode,
      resolveConflict,
      updateExecutionGate: updateExecutionGateAction,
      switchBranch,
      getNode,
      getActiveBranch,
      getBranchTimeline
    }),
    [
      state,
      addNode,
      forkAtNode,
      resolveConflict,
      updateExecutionGateAction,
      switchBranch,
      getNode,
      getActiveBranch,
      getBranchTimeline
    ]
  );

  return <ThoughtTreeContext.Provider value={api}>{children}</ThoughtTreeContext.Provider>;
}

/**
 * Accesses ThoughtTree API from React context.
 * Throws a helpful error when used outside ThoughtTreeProvider.
 */
export function useThoughtTree(): UseThoughtTreeAPI {
  const context = React.useContext(ThoughtTreeContext);
  if (!context) {
    throw new Error(
      "[Vitreous] useThoughtTree must be used within <ThoughtTreeProvider initialState={...}>."
    );
  }
  return context;
}
