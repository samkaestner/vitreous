"use client";

import * as React from "react";
import type { ConflictNode, ThoughtNode } from "@vitreous/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";

export type ConflictNodeUIProps = {
  node: ConflictNode;
  isActive: boolean;
};

export function ConflictNodeUI({ node, isActive }: ConflictNodeUIProps) {
  const { getNode, resolveConflict } = useThoughtTree();
  
  const contenders = React.useMemo(() => {
    return node.contenders
      .map((id) => getNode(id))
      .filter((n): n is ThoughtNode => Boolean(n));
  }, [node.contenders, getNode]);

  const isResolved = Boolean(node.resolution);

  const handleResolve = (chosenId: string) => {
    resolveConflict({
      conflictNodeId: node.id,
      chosenNodeId: chosenId,
    });
  };

  const containerBaseClasses = "w-full max-w-[320px] mx-auto rounded-[1.25rem] border p-4 shadow-gb-node transition-colors text-left";
  
  const stateClasses = !isActive
    ? "border-red-400/10 bg-red-950/10"
    : isResolved
    ? "border-emerald-400/30 bg-emerald-950/20"
    : "border-red-500/50 bg-[#160b0b]"; // Y-junction warning feel

  return (
    <div className={`${containerBaseClasses} ${stateClasses}`}>
      <div className="flex items-start justify-between gap-3 border-b border-red-500/20 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-red-400/80">
            {isResolved ? "Resolved Conflict" : "Synthesis Clash"}
          </p>
          <h3 className={`mt-1 text-sm font-semibold tracking-tight ${isActive ? "text-white/95" : "text-white/60"}`}>
            {node.description ?? "Contradictory data detected"}
          </h3>
        </div>

      </div>

      <div className="mt-4 flex flex-col gap-3">
        {contenders.map((contender) => {
          const isChosen = node.resolution?.chosen === contender.id;
          const isDiscarded = isResolved && !isChosen;
          
          let title: string = contender.type;
          let preview = "";
          
          if (contender.type === "citation") {
            title = contender.source.domain ?? contender.source.title ?? "Citation";
            preview = contender.excerpt ?? contender.source.uri;
          } else if (contender.type === "decision") {
            title = "Previous Decision";
            preview = contender.claim;
          }

          return (
            <div
              key={contender.id}
              className={`flex flex-col justify-between rounded-[0.85rem] border p-3 transition ${
                isChosen
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : isDiscarded
                  ? "border-white/5 bg-white/5 opacity-50"
                  : "border-red-400/20 bg-red-950/20 hover:border-red-400/40"
              }`}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
                  {title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-white/80 line-clamp-4">
                  {preview}
                </p>
              </div>

              {isActive && !isResolved && (
                <button
                  onClick={() => handleResolve(contender.id)}
                  className="mt-3 w-full rounded-[0.75rem] border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-400/50"
                >
                  Resolve using this
                </button>
              )}
              {isChosen && (
                <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                  Selected Authority
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* If we needed manual text override, we could add a third option below */}
    </div>
  );
}
