"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CitationNode, DecisionNode, ForkSteering } from "@vitreous/core";

export type DecisionModalStage = "details" | "steer";

export type DecisionModalProps = {
  /** Whether the modal is currently open. */
  open: boolean;
  /** The decision being inspected. */
  decision: DecisionNode;
  /** Citations resolved from `decision.provenance` for the details surface. */
  citations: ReadonlyArray<CitationNode>;
  /** Optional initial stage; defaults to `"details"`. */
  initialStage?: DecisionModalStage;
  /** When true, fork action is in flight and the modal is locked. */
  isForking?: boolean;
  /** Called when the modal should close (Cancel, Close, Escape, backdrop). */
  onClose: () => void;
  /** Called when the user confirms a fork; receives the captured steering. */
  onConfirmFork: (steering: ForkSteering) => void;
};

function getDecisionConfidenceTone(confidence: number): {
  label: string;
  badgeClasses: string;
} {
  if (confidence >= 0.85) {
    return {
      label: "very high",
      badgeClasses: "border-emerald-300/90 bg-emerald-500/20 text-emerald-100"
    };
  }
  if (confidence >= 0.7) {
    return {
      label: "high",
      badgeClasses: "border-lime-300/90 bg-lime-500/18 text-lime-100"
    };
  }
  if (confidence >= 0.5) {
    return {
      label: "medium",
      badgeClasses: "border-amber-300/90 bg-amber-500/18 text-amber-100"
    };
  }
  if (confidence >= 0.3) {
    return {
      label: "low",
      badgeClasses: "border-orange-300/90 bg-orange-500/18 text-orange-100"
    };
  }
  return {
    label: "very low",
    badgeClasses: "border-red-300/90 bg-red-500/18 text-red-100"
  };
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function trapTab(event: KeyboardEvent, container: HTMLElement | null) {
  if (!container || event.key !== "Tab") {
    return;
  }
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute("data-focus-trap-skip"));
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Two-stage modal for inspecting a decision and forking the reasoning chain.
 *
 * Stage A ("details") presents the rationale and full provenance for the decision.
 * Stage B ("steer") collects optional steering: a free-form prompt and/or a selected
 * `DecisionAlternative`. The selected alternative pre-fills the textarea but stays
 * editable so the user can refine the directive in plain language.
 */
export function DecisionModal(props: DecisionModalProps) {
  const {
    open,
    decision,
    citations,
    initialStage = "details",
    isForking = false,
    onClose,
    onConfirmFork
  } = props;

  const [stage, setStage] = React.useState<DecisionModalStage>(initialStage);
  const [steeringPrompt, setSteeringPrompt] = React.useState("");
  const [selectedAlternativeId, setSelectedAlternativeId] = React.useState<string | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const primaryButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const confidence = Math.max(0, Math.min(1, decision.confidence));
  const confidencePct = Math.round(confidence * 100);
  const tone = getDecisionConfidenceTone(confidence);

  React.useEffect(() => {
    if (open) {
      setStage(initialStage);
      setSteeringPrompt("");
      setSelectedAlternativeId(null);
    }
  }, [open, initialStage, decision.id]);

  const syncTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isForking) {
        event.preventDefault();
        onClose();
        return;
      }
      trapTab(event, dialogRef.current);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isForking]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const target = stage === "steer" ? confirmButtonRef.current : primaryButtonRef.current;
    target?.focus();
    if (stage === "steer") {
      syncTextareaHeight();
    }
  }, [open, stage, syncTextareaHeight]);

  const handleSelectAlternative = React.useCallback(
    (altId: string, prefill: string) => {
      if (selectedAlternativeId === altId) {
        setSelectedAlternativeId(null);
        return;
      }
      setSelectedAlternativeId(altId);
      setSteeringPrompt(prefill);
    },
    [selectedAlternativeId]
  );

  React.useEffect(() => {
    if (!open || stage !== "steer") {
      return;
    }
    syncTextareaHeight();
  }, [open, stage, steeringPrompt, syncTextareaHeight]);

  const handleConfirm = React.useCallback(() => {
    const trimmedPrompt = steeringPrompt.trim();
    const steering: ForkSteering = {};
    if (trimmedPrompt.length > 0) {
      (steering as { prompt?: string }).prompt = trimmedPrompt;
    }
    if (selectedAlternativeId) {
      (steering as { selectedAlternativeId?: string }).selectedAlternativeId = selectedAlternativeId;
    }
    onConfirmFork(steering);
  }, [onConfirmFork, selectedAlternativeId, steeringPrompt]);

  const titleId = `decision-modal-title-${decision.id}`;
  const stageTitle = stage === "details" ? "Decision details" : "Fork with steering";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="decision-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (!isForking) {
              onClose();
            }
          }}
        >
          <motion.div
            key="decision-modal-panel"
            ref={dialogRef}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-[1.25rem] border border-white/12 bg-[#101521] p-6 shadow-gb-rail"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  {stageTitle}
                </p>
                <h2
                  id={titleId}
                  className="mt-2 truncate text-base font-semibold tracking-tight text-white"
                >
                  {decision.claim}
                </h2>
              </div>
              <span
                className={[
                  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                  tone.badgeClasses
                ].join(" ")}
                aria-label={`${confidencePct}% confidence (${tone.label})`}
              >
                {confidencePct}% · {tone.label}
              </span>
            </div>

            <AnimatePresence initial={false}>
              {stage === "details" ? (
                <motion.div
                  key="stage-details"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="mt-5 space-y-5"
                >
                  <section>
                    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      Rationale
                    </h3>
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 shadow-inner">
                      <p className="text-[13px] leading-relaxed text-white/80">
                        {decision.rationale ?? "No rationale provided for this decision."}
                      </p>
                    </div>
                  </section>

                  <section>
                    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      Provenance
                    </h3>
                    {citations.length > 0 ? (
                      <ul className="mt-3 grid grid-cols-1 gap-2">
                        {citations.map((citation, i) => (
                          <motion.li
                            key={citation.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15, delay: i * 0.05 }}
                            className="group relative flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.05]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <a
                                href={citation.source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 font-medium text-[13px] text-white/90 underline-offset-2 group-hover:text-white group-hover:underline before:absolute before:inset-0"
                              >
                                {citation.source.title ?? citation.source.domain ?? citation.source.uri}
                              </a>
                              {citation.source.domain ? (
                                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                                  {citation.source.domain}
                                </span>
                              ) : null}
                            </div>
                            {citation.excerpt ? (
                              <div className="rounded-md bg-black/30 p-2.5 border border-white/5">
                                <p className="text-[12px] leading-relaxed text-white/60 line-clamp-3">
                                  {citation.excerpt}
                                </p>
                              </div>
                            ) : null}
                          </motion.li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[13px] text-white/55">
                        No citations were attached to this decision.
                      </p>
                    )}
                  </section>
                </motion.div>
              ) : (
                <motion.div
                  key="stage-steer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="mt-5 space-y-5"
                >
                  {decision.alternatives && decision.alternatives.length > 0 ? (
                    <section>
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                        Suggested directions
                      </h3>
                      <div className="mt-2 grid gap-2">
                        {decision.alternatives.slice(0, 2).map((alt) => {
                          const isSelected = selectedAlternativeId === alt.id;
                          return (
                            <button
                              key={alt.id}
                              type="button"
                              onClick={() =>
                                handleSelectAlternative(alt.id, alt.description ?? alt.label)
                              }
                              aria-pressed={isSelected}
                              className={[
                                "rounded-[0.85rem] border px-3 py-2.5 text-left transition",
                                isSelected
                                  ? "border-[#e0bc78]/80 bg-[#e0bc78]/10 text-white"
                                  : "border-white/12 bg-white/[0.03] text-white/80 hover:border-white/30 hover:text-white"
                              ].join(" ")}
                            >
                              <p className="text-sm font-semibold tracking-tight">{alt.label}</p>
                              {alt.description ? (
                                <p className="mt-0.5 text-[12px] leading-relaxed text-white/60">
                                  {alt.description}
                                </p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                      {selectedAlternativeId ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAlternativeId(null)}
                          className="mt-2 text-[11px] font-medium text-white/55 underline-offset-2 hover:text-white/85 hover:underline"
                        >
                          Clear selection
                        </button>
                      ) : null}
                    </section>
                  ) : null}

                  <section>
                    <label
                      htmlFor={`decision-modal-steering-${decision.id}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
                    >
                      Steer the LLM
                    </label>
                    <textarea
                      id={`decision-modal-steering-${decision.id}`}
                      ref={textareaRef}
                      value={steeringPrompt}
                      onChange={(event) => setSteeringPrompt(event.target.value)}
                      placeholder="Describe how the AI should reason differently from this point..."
                      rows={1}
                      className="mt-2 w-full resize-none overflow-hidden rounded-[0.85rem] border border-white/12 bg-[#0c111c] px-3 py-2 text-sm leading-relaxed text-white/90 placeholder:text-white/35 focus:border-[#e0bc78]/60 focus:outline-none focus:ring-2 focus:ring-white/10"
                    />
                    <p className="mt-1.5 text-[11px] text-white/45">
                      Optional. Leave blank to fork without an explicit directive.
                    </p>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {stage === "steer" ? (
                <button
                  type="button"
                  onClick={() => setStage("details")}
                  disabled={isForking}
                  className="rounded-[0.75rem] border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                disabled={isForking}
                className="rounded-[0.75rem] border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stage === "steer" ? "Cancel" : "Close"}
              </button>
              {stage === "details" ? (
                <button
                  type="button"
                  ref={primaryButtonRef}
                  onClick={() => setStage("steer")}
                  className="rounded-[0.75rem] border border-[#e0bc78]/70 bg-[#e0bc78] px-4 py-2 text-sm font-semibold text-[#1a1407] transition hover:bg-[#ecc685] active:scale-[0.98]"
                >
                  Fork from here
                </button>
              ) : (
                <button
                  type="button"
                  ref={confirmButtonRef}
                  onClick={handleConfirm}
                  disabled={isForking}
                  className="rounded-[0.75rem] border border-[#e0bc78]/70 bg-[#e0bc78] px-4 py-2 text-sm font-semibold text-[#1a1407] transition hover:bg-[#ecc685] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  {isForking ? "Forking..." : "Confirm fork"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
