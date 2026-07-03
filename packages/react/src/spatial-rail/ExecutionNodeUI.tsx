"use client";

import * as React from "react";
import type { ExecutionNode } from "@vitreous/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";

export type ExecutionNodeUIProps = {
  node: ExecutionNode;
  isActive: boolean;
};

export function ExecutionNodeUI({ node, isActive }: ExecutionNodeUIProps) {
  const { updateExecutionGate } = useThoughtTree();
  const [isModifying, setIsModifying] = React.useState(false);
  const [isExplaining, setIsExplaining] = React.useState(false);
  
  // Initialize payload string
  const [payloadStr, setPayloadStr] = React.useState(() => {
    try {
      return JSON.stringify(node.action.payload, null, 2);
    } catch {
      return String(node.action.payload);
    }
  });

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const syncTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    if (isModifying) {
      syncTextareaHeight();
    }
  }, [isModifying, payloadStr, syncTextareaHeight]);

  const handleStatusChange = (
    status: "allowed_once" | "always_allowed" | "rejected",
    reason?: string
  ) => {
    updateExecutionGate({
      executionNodeId: node.id,
      status,
      decidedBy: "user",
      reason,
    });
  };

  const isPending = node.gate.status === "pending";
  const containerBaseClasses = "w-[340px] rounded-[1.25rem] border p-4 shadow-gb-node transition-colors text-left";
  
  const stateClasses = !isActive
    ? "border-white/10 bg-white/[0.02]"
    : isPending
    ? "border-orange-400/50 bg-orange-950/20"
    : node.gate.status === "rejected"
    ? "border-red-400/30 bg-red-950/20"
    : "border-emerald-400/30 bg-emerald-950/20";

  return (
    <div className={`${containerBaseClasses} ${stateClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">
            {node.action.kind}
          </p>
          <h3 className={`mt-1 text-sm font-semibold tracking-tight ${isActive ? "text-white/95" : "text-white/60"}`}>
            {node.action.summary}
          </h3>
        </div>
        <div
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isPending
              ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
              : node.gate.status === "rejected"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          } ${!isActive ? "opacity-50" : ""}`}
        >
          {node.gate.status.replace("_", " ")}
        </div>
      </div>

      <div className="mt-4">
        {isExplaining && node.action.explanation && (
          <div className="mb-4 rounded-[0.85rem] border border-[#e0bc78]/30 bg-[#e0bc78]/5 p-3">
            <p className="text-xs leading-relaxed text-[#e0bc78]/90">
              {node.action.explanation}
            </p>
          </div>
        )}
        {isModifying && isPending && isActive ? (
          <div>
            <label
              htmlFor={`payload-editor-${node.id}`}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
            >
              Modify Payload
            </label>
            <textarea
              id={`payload-editor-${node.id}`}
              ref={textareaRef}
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              className="mt-2 w-full resize-none overflow-hidden rounded-[0.85rem] border border-white/12 bg-[#0c111c] px-3 py-2 text-xs font-mono leading-relaxed text-white/90 placeholder:text-white/35 focus:border-[#e0bc78]/60 focus:outline-none focus:ring-2 focus:ring-white/10"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="max-h-44 overflow-y-auto rounded-[0.85rem] border border-white/10 bg-black/20 p-3">
            <pre className={`whitespace-pre-wrap break-words text-[11px] font-mono leading-relaxed ${isActive ? "text-white/70" : "text-white/40"}`}>
              {payloadStr}
            </pre>
          </div>
        )}
      </div>

      {isPending && isActive && (
        <div className={`mt-5 grid gap-2 ${node.action.explanation && !isModifying ? "grid-cols-3" : "grid-cols-2"}`}>
          {isModifying ? (
            <>
              <button
                onClick={() => setIsModifying(false)}
                className="rounded-[0.75rem] border border-white/15 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                Cancel Edit
              </button>
              <button
                onClick={() => handleStatusChange("allowed_once", "Modified payload manually")}
                className="rounded-[0.75rem] border border-[#e0bc78]/70 bg-[#e0bc78] px-3 py-2 text-xs font-semibold text-[#1a1407] transition hover:bg-[#ecc685] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#e0bc78]/50"
              >
                Execute Modified
              </button>
            </>
          ) : (
            <>
              {node.action.explanation && (
                <button
                  onClick={() => setIsExplaining((prev) => !prev)}
                  className={`rounded-[0.75rem] border px-3 py-2 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-[#e0bc78]/40 ${
                    isExplaining 
                      ? "border-[#e0bc78]/50 bg-[#e0bc78]/10 text-[#e0bc78]" 
                      : "border-white/15 text-white/80 hover:border-white/35 hover:text-white"
                  }`}
                >
                  {isExplaining ? "Hide Info" : "Explain"}
                </button>
              )}
              <button
                onClick={() => setIsModifying(true)}
                className="rounded-[0.75rem] border border-white/15 px-3 py-2 text-[11px] font-medium text-white/80 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                Modify
              </button>
              <button
                onClick={() => handleStatusChange("rejected")}
                className="rounded-[0.75rem] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              >
                Reject
              </button>
              <button
                onClick={() => handleStatusChange("allowed_once")}
                className={`${node.action.explanation ? "col-span-3" : "col-span-2"} rounded-[0.75rem] border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
              >
                Allow Once
              </button>
              <button
                onClick={() => handleStatusChange("always_allowed")}
                className={`${node.action.explanation ? "col-span-3" : "col-span-2"} mt-1 rounded text-[10px] font-medium text-white/40 transition hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-white/20`}
              >
                Always allow this action
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
