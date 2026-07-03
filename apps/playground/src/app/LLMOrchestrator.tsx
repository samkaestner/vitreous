"use client";

import React, { useState, useEffect, useRef } from "react";
import { SpatialRail, useVitreous } from "@vitreous/react";
import type { DecisionNode, ExecutionNode } from "@vitreous/core";
import { askVitreous, askVitreousContinuation } from "./actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  nodeId?: string;
};

export function LLMOrchestrator() {
  const {
    completeRun,
    events,
    getNode,
    recordConflict,
    recordDecision,
    recordSource,
    requestActionApproval,
    state,
    status
  } = useVitreous();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [mode, setMode] = useState<"live" | "replay" | null>(null);
  
  const lastQueryRef = useRef<string>("");
  const processedConflictIds = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const restoredChatRef = useRef(false);
  const completedRunRef = useRef(false);
  const activeTimeline = state.branchesById[state.activeBranchId]?.timeline ?? [];
  const lastActiveNodeId = activeTimeline[activeTimeline.length - 1];
  const lastActiveNode = lastActiveNodeId ? state.nodesById[lastActiveNodeId] : undefined;
  const hasBlockingConflict = lastActiveNode?.type === "conflict" && !lastActiveNode.resolution;
  const isRailVisible = isRailOpen || hasBlockingConflict;
  const branchCount = Object.keys(state.branchesById).length;
  const eventLabel = `${events.length} audit event${events.length === 1 ? "" : "s"}`;
  const branchLabel = `${branchCount} branch${branchCount === 1 ? "" : "es"}`;

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Rebuild the chat transcript from the replayed event log on mount, since
  // messages are component state and don't survive a reload the way the rail does.
  useEffect(() => {
    if (restoredChatRef.current || messages.length > 0) {
      return;
    }

    const hasRestorableEvent = events.some(
      (event) =>
        (event.type === "source.added" && event.payload.source.kind === "user") ||
        event.type === "conflict.detected" ||
        event.type === "decision.made"
    );
    if (!hasRestorableEvent) {
      return;
    }

    restoredChatRef.current = true;

    const restored: Message[] = [];
    let lastUserExcerpt = "";
    for (const event of events) {
      if (event.type === "source.added" && event.payload.source.kind === "user") {
        const content = event.payload.excerpt ?? "";
        restored.push({ id: event.id, role: "user", content });
        lastUserExcerpt = content;
      } else if (event.type === "conflict.detected") {
        restored.push({
          id: event.id,
          role: "assistant",
          content: "I've encountered a conflict between the studies. Please check the explainability rail to resolve it."
        });
      } else if (event.type === "decision.made") {
        restored.push({ id: event.id, role: "assistant", content: event.payload.claim });
      }
    }

    setMessages(restored);
    if (lastUserExcerpt) {
      lastQueryRef.current = lastUserExcerpt;
    }
  }, [events, messages.length]);

  // Complete the run once every execution gate on the active branch has been
  // resolved, instead of immediately after requesting approval.
  useEffect(() => {
    if (status !== "running" || completedRunRef.current) {
      return;
    }

    const activeNodes = activeTimeline
      .map((nodeId) => state.nodesById[nodeId])
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
    const hasDecision = activeNodes.some((node) => node.type === "decision");
    const executionNodes = activeNodes.filter(
      (node): node is ExecutionNode => node.type === "execution"
    );

    if (!hasDecision || executionNodes.length === 0) {
      return;
    }

    const hasPendingGate = executionNodes.some((node) => node.gate.status === "pending");
    if (hasPendingGate) {
      return;
    }

    const latestDecision = [...activeNodes]
      .reverse()
      .find((node): node is DecisionNode => node.type === "decision");
    if (!latestDecision) {
      return;
    }

    completedRunRef.current = true;
    completeRun({ summary: latestDecision.claim });
  }, [activeTimeline, completeRun, state, status]);

  const handleContinuation = React.useCallback(async (chosenLabel: string, conflictDescription: string) => {
    setIsLoading(true);
    try {
      const preferenceMsg = chosenLabel 
        ? `I've received your preference for ${chosenLabel}. Resuming synthesis...`
        : "I've received your preference. Resuming synthesis...";

      setMessages(prev => [...prev, {
        id: "resolving-" + Date.now(),
        role: "assistant",
        content: preferenceMsg
      }]);

      // Use the dedicated continuation action (decision-only, no conflict loop)
      const result = await askVitreousContinuation(
        lastQueryRef.current,
        chosenLabel,
        conflictDescription
      );
      
      // Remove the "resolving" placeholder
      setMessages(prev => prev.filter(m => !m.id.startsWith("resolving-")));

      // Result is guaranteed to be a decision. Ground it in the citations
      // already on the active branch (the studies plus the user prompt).
      const payload = result.decisionPayload;
      const provenance = (state.branchesById[state.activeBranchId]?.timeline ?? []).flatMap(
        (nodeId) => {
          const candidate = state.nodesById[nodeId];
          return candidate && candidate.type === "citation" ? [candidate.id] : [];
        }
      );
      const decision = recordDecision({
        claim: payload.claim,
        confidence: payload.confidence,
        rationale: payload.rationale,
        provenance,
        alternatives: payload.alternatives || []
      });
      requestActionApproval({
        action: {
          kind: "demo.audit.save",
          payload: {
            decisionNodeId: decision.nodeId ?? "",
            claim: payload.claim
          },
          summary: "Save answer to audit history",
          explanation:
            "The playground records assistant outputs as auditable events so the host app can persist or reject downstream side effects."
        }
      });

      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        role: "assistant",
        content: payload.claim
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [recordDecision, requestActionApproval, state]);

  // Auto-continuation loop: watch for resolved conflicts on the active branch.
  useEffect(() => {
    if (
      !lastActiveNode ||
      lastActiveNode.type !== "conflict" ||
      !lastActiveNode.resolution ||
      processedConflictIds.current.has(lastActiveNode.id)
    ) {
      return;
    }

    processedConflictIds.current.add(lastActiveNode.id);

    const chosenNodeId = lastActiveNode.resolution.chosen;
    const chosenNode = getNode(chosenNodeId);
    const chosenLabel =
      chosenNode?.type === "citation"
        ? chosenNode.source.title ?? chosenNode.source.uri
        : chosenNodeId;

    void handleContinuation(
      chosenLabel,
      lastActiveNode.description ?? "Contradictory data detected"
    );
  }, [getNode, handleContinuation, lastActiveNode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);
    lastQueryRef.current = query;

    const userPrompt = recordSource({
      source: { kind: "user", uri: "user://prompt", title: "User prompt" },
      excerpt: query
    });
    const userPromptNodeId = userPrompt.nodeId;

    try {
      const result = await askVitreous(query);
      setMode(result.mode ?? "live");

      const citationIds: string[] = [];
      for (const citation of result.citations) {
        if (citation.type !== "citation") {
          continue;
        }
        const recorded = recordSource({
          source: citation.source,
          excerpt: citation.excerpt,
          contentHash: citation.contentHash,
          tags: citation.tags
        });
        if (recorded.nodeId) {
          citationIds.push(recorded.nodeId);
        }
      }

      if (result.llmResponse.nodeType === "decision") {
        const payload = result.llmResponse.decisionPayload;
        const decision = recordDecision({
          claim: payload.claim,
          confidence: payload.confidence,
          rationale: payload.rationale,
          provenance: userPromptNodeId ? [...citationIds, userPromptNodeId] : citationIds,
          alternatives: payload.alternatives || []
        });
        requestActionApproval({
          action: {
            kind: "demo.audit.save",
            payload: {
              decisionNodeId: decision.nodeId ?? "",
              claim: payload.claim
            },
            summary: "Save answer to audit history",
            explanation:
              "The host app controls whether this assistant output becomes part of a durable audit trail."
          }
        });

        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: payload.claim
        }]);
      } else if (result.llmResponse.nodeType === "conflict") {
        setIsRailOpen(true);
        recordConflict({
          contenders: citationIds.length >= 2 ? citationIds.slice(-2) : citationIds,
          description: result.llmResponse.conflictPayload.description
        });
        
        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: "I've encountered a conflict between the studies. Please check the explainability rail to resolve it."
        }]);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to call LLM: " + String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[85vh] w-full gap-4 overflow-hidden p-4">
      {/* LEFT PANE: CHAT */}
      <div className="flex flex-1 flex-col rounded-3xl bg-[#0d1117] border border-white/5 overflow-hidden shadow-2xl relative">
        {mode === "replay" && (
          <div className="absolute top-4 left-6 z-10 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300/80 pointer-events-none">
            Scripted replay · no live model
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                 <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <h2 className="text-xl font-medium text-white">Vitreous Orchestrator</h2>
              <p className="text-sm mt-2 max-w-xs">Ask a question about your endurance studies to begin the reasoning chain.</p>
              <button
                type="button"
                onClick={() => setQuery("How should I structure my training to prepare for a marathon?")}
                className="mt-5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300/90 hover:bg-emerald-500/20 transition pointer-events-auto"
              >
                Try: “How should I structure my training for a marathon?”
              </button>
            </div>
          )}
          
          {messages.map((m) => (
            <div 
              key={m.id} 
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-lg ${
                  m.role === "user" 
                    ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-50" 
                    : "bg-white/5 border border-white/10 text-white"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-black/20 border-t border-white/5">
          <div className="relative">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your training split..."
              className="w-full bg-[#161b22] border border-white/10 rounded-full px-6 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 transition shadow-inner"
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 bottom-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-5 rounded-full font-medium transition disabled:opacity-30 border border-emerald-500/20"
            >
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT PANE: EXPLAINABILITY RAIL */}
      <div 
        className={`transition-all duration-500 ease-in-out flex flex-col rounded-3xl bg-[#0d1117] border border-white/5 shadow-2xl relative ${
          isRailVisible ? "w-[400px]" : "w-0 overflow-hidden opacity-0 pointer-events-none translate-x-12"
        }`}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
          <div className="min-w-0 pl-2">
            <span className="block text-[10px] font-bold tracking-widest text-white/40 uppercase">
              Explainability Rail
            </span>
            <span className="mt-1 block truncate text-[11px] text-white/35">
              {eventLabel} · {branchLabel} · {status}
            </span>
          </div>
          <button 
            onClick={() => setIsRailOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition text-white/40 hover:text-white/80"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <SpatialRail aria-label="Spatial rail" />
        </div>
      </div>

      {/* COLLAPSED RAIL TAB */}
      {!isRailVisible && (
        <button 
          onClick={() => setIsRailOpen(true)}
          className="fixed right-6 top-1/2 -translate-y-1/2 w-10 h-32 bg-[#0d1117] border border-white/10 rounded-full flex flex-col items-center justify-center gap-4 group hover:bg-white/5 transition-colors shadow-2xl z-50"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="[writing-mode:vertical-lr] text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase group-hover:text-white/60 transition-colors">Explainability</span>
        </button>
      )}
    </div>
  );
}
