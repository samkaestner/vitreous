"use client";

import * as React from "react";
import {
  VitreousProvider,
  createLocalStorageVitreousPersistence
} from "@vitreous/react";
import { LLMOrchestrator } from "./LLMOrchestrator";

export function RailDemo() {
  const persistence = React.useMemo(
    () => createLocalStorageVitreousPersistence("vitreous:playground"),
    []
  );

  return (
    <VitreousProvider
      runId="playground-demo"
      title="Vitreous playground"
      persistence={persistence}
    >
      <LLMOrchestrator />
    </VitreousProvider>
  );
}
