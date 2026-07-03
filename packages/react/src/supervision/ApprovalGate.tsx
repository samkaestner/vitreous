"use client";

import * as React from "react";
import type { ExecutionGateStatus, ExecutionNode } from "@vitreous/core";
import { useVitreous } from "../vitreous/VitreousContext.js";

export type ApprovalGateDecision = Exclude<ExecutionGateStatus, "pending">;

export type ApprovalGateProps = Readonly<{
  node?: ExecutionNode;
  nodeId?: string;
  className?: string;
  onApprove?: (node: ExecutionNode, status: "allowed_once" | "always_allowed") => void | Promise<void>;
  onReject?: (node: ExecutionNode) => void | Promise<void>;
}>;

export function ApprovalGate(props: ApprovalGateProps) {
  const { nodeId, className, onApprove, onReject } = props;
  const vitreous = useVitreous();
  const resolvedNode =
    props.node ??
    (nodeId && vitreous.state.nodesById[nodeId]?.type === "execution"
      ? vitreous.state.nodesById[nodeId]
      : undefined);
  const [isBusy, setIsBusy] = React.useState(false);

  if (!resolvedNode) {
    return null;
  }

  const decide = async (status: ApprovalGateDecision) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      if (status === "rejected") {
        await onReject?.(resolvedNode);
      } else {
        await onApprove?.(resolvedNode, status);
      }
      vitreous.resolveActionApproval({
        executionNodeId: resolvedNode.id,
        status,
        decidedBy: "user"
      });
    } finally {
      setIsBusy(false);
    }
  };

  const isPending = resolvedNode.gate.status === "pending";

  return (
    <section
      className={[
        "rounded-[1rem] border border-white/10 bg-[#181a1f] p-4 text-left shadow-none",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Action approval"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            Action gate
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-white/90">
            {resolvedNode.action.summary}
          </h3>
          {resolvedNode.action.explanation ? (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/52">
              {resolvedNode.action.explanation}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.03] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/48">
          {resolvedNode.gate.status.replace("_", " ")}
        </span>
      </div>

      {isPending ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void decide("rejected")}
            className="rounded-[0.75rem] border border-white/12 px-3 py-2 text-xs font-medium text-white/64 transition hover:border-white/28 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void decide("allowed_once")}
            className="rounded-[0.75rem] border border-white/22 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/92 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Allow once
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void decide("always_allowed")}
            className="col-span-2 rounded-[0.7rem] px-3 py-1.5 text-[11px] font-medium text-white/42 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Always allow this action
          </button>
        </div>
      ) : null}
    </section>
  );
}
