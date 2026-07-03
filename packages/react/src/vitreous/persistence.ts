"use client";

import type { VitreousPersistenceAdapter, VitreousSerializedRun } from "@vitreous/core";

function isBrowserStorageAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function getRunStorageKey(baseKey: string, runId: string): string {
  return `${baseKey}:run:${runId}`;
}

export function createInMemoryVitreousPersistence(
  initialRuns: ReadonlyArray<VitreousSerializedRun> = []
): VitreousPersistenceAdapter {
  const runs = new Map(initialRuns.map((run) => [run.runId, run] as const));
  let latestRunId = initialRuns.at(-1)?.runId;

  return {
    load: (runId) => {
      if (runId) {
        return runs.get(runId) ?? null;
      }
      return latestRunId ? runs.get(latestRunId) ?? null : null;
    },
    save: (run) => {
      runs.set(run.runId, run);
      latestRunId = run.runId;
    },
    clear: (runId) => {
      if (runId) {
        runs.delete(runId);
        if (latestRunId === runId) {
          latestRunId = undefined;
        }
        return;
      }
      runs.clear();
      latestRunId = undefined;
    }
  };
}

export function createLocalStorageVitreousPersistence(
  baseKey = "vitreous"
): VitreousPersistenceAdapter {
  const latestKey = `${baseKey}:latest`;

  return {
    load: (runId) => {
      if (!isBrowserStorageAvailable()) {
        return null;
      }
      const resolvedRunId = runId ?? window.localStorage.getItem(latestKey);
      if (!resolvedRunId) {
        return null;
      }
      const raw = window.localStorage.getItem(getRunStorageKey(baseKey, resolvedRunId));
      return raw ? (JSON.parse(raw) as VitreousSerializedRun) : null;
    },
    save: (run) => {
      if (!isBrowserStorageAvailable()) {
        return;
      }
      window.localStorage.setItem(getRunStorageKey(baseKey, run.runId), JSON.stringify(run));
      window.localStorage.setItem(latestKey, run.runId);
    },
    clear: (runId) => {
      if (!isBrowserStorageAvailable()) {
        return;
      }
      const resolvedRunId = runId ?? window.localStorage.getItem(latestKey);
      if (resolvedRunId) {
        window.localStorage.removeItem(getRunStorageKey(baseKey, resolvedRunId));
      }
      if (!runId || runId === window.localStorage.getItem(latestKey)) {
        window.localStorage.removeItem(latestKey);
      }
    }
  };
}
