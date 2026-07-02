import type { VitreousEvent } from "./events.js";
import type { ThoughtNode } from "./nodes.js";

export type VitreousPrivacyHooks<TViewer = unknown, TRawTrace = unknown> = Readonly<{
  /**
   * Return a sanitized event for persistence/transmission, or null to omit it.
   */
  redactEvent?: (event: VitreousEvent) => VitreousEvent | null;
  /**
   * Gate whether a node should be visible to a viewer in UI surfaces.
   */
  shouldExposeNode?: (node: ThoughtNode, viewer?: TViewer) => boolean;
  /**
   * Convert raw model/provider trace data into safe user-facing summary copy.
   */
  summarizeForUser?: (rawModelTrace: TRawTrace) => string;
}>;

export function redactEvent(event: VitreousEvent): VitreousEvent {
  return event;
}

export function shouldExposeNode(): boolean {
  return true;
}

export function summarizeForUser(rawModelTrace: unknown): string {
  if (typeof rawModelTrace === "string") {
    return rawModelTrace;
  }
  return "The assistant recorded a supervision event.";
}

export function applyEventRedaction(
  event: VitreousEvent,
  hooks: VitreousPrivacyHooks = {}
): VitreousEvent | null {
  return hooks.redactEvent ? hooks.redactEvent(event) : redactEvent(event);
}
