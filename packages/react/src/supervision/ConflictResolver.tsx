"use client";

import * as React from "react";
import type { ConflictNode, ThoughtNode } from "@vitreous/core";
import { useVitreous } from "../vitreous/VitreousContext.js";

export type ConflictResolverProps = Readonly<{
  node?: ConflictNode;
  nodeId?: string;
  className?: string;
  onResolve?: (conflict: ConflictNode, chosen: ThoughtNode) => void | Promise<void>;
}>;

function getContenderTitle(node: ThoughtNode): string {
  if (node.type === "citation") {
    return node.source.title ?? node.source.domain ?? node.source.uri;
  }
  if (node.type === "decision") {
    return node.claim;
  }
  if (node.type === "execution") {
    return node.action.summary;
  }
  return node.description ?? "Conflict";
}

function getContenderDetail(node: ThoughtNode): string {
  if (node.type === "citation") {
    return node.excerpt ?? node.source.uri;
  }
  if (node.type === "decision") {
    return node.rationale ?? `${Math.round(node.confidence * 100)}% confidence`;
  }
  if (node.type === "execution") {
    return node.action.explanation ?? node.action.kind;
  }
  return `${node.contenders.length} contenders`;
}

export function ConflictResolver(props: ConflictResolverProps) {
  const { nodeId, className, onResolve } = props;
  const vitreous = useVitreous();
  const resolvedNode =
    props.node ??
    (nodeId && vitreous.state.nodesById[nodeId]?.type === "conflict"
      ? vitreous.state.nodesById[nodeId]
      : undefined);
  const [isBusy, setIsBusy] = React.useState(false);

  if (!resolvedNode) {
    return null;
  }

  const contenders = resolvedNode.contenders
    .map((contenderId) => vitreous.state.nodesById[contenderId])
    .filter((node): node is ThoughtNode => Boolean(node));

  const resolve = async (chosen: ThoughtNode) => {
    if (isBusy || resolvedNode.resolution) {
      return;
    }
    setIsBusy(true);
    try {
      await onResolve?.(resolvedNode, chosen);
      vitreous.resolveRecordedConflict({
        conflictNodeId: resolvedNode.id,
        chosenNodeId: chosen.id
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section
      className={[
        "rounded-[1rem] border border-white/10 bg-[#181a1f] p-4 text-left shadow-none",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Conflict resolver"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            Conflict
          </p>
          <h3 className="mt-1 text-sm font-semibold leading-5 text-white/90">
            {resolvedNode.description ?? "Contradictory evidence detected"}
          </h3>
        </div>
        {resolvedNode.resolution ? (
          <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-100/72">
            Resolved
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2">
        {contenders.map((contender) => {
          const isChosen = resolvedNode.resolution?.chosen === contender.id;

          return (
            <button
              key={contender.id}
              type="button"
              disabled={isBusy || Boolean(resolvedNode.resolution)}
              onClick={() => void resolve(contender)}
              className={[
                "rounded-[0.85rem] border p-3 text-left transition disabled:cursor-default",
                isChosen
                  ? "border-emerald-300/28 bg-emerald-400/10"
                  : "border-white/10 bg-white/[0.025] hover:border-white/24 hover:bg-white/[0.045]",
                resolvedNode.resolution && !isChosen ? "opacity-45" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <p className="line-clamp-1 text-xs font-semibold text-white/82">
                {getContenderTitle(contender)}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/44">
                {getContenderDetail(contender)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
