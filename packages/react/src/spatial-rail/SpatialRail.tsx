"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BranchId, CitationNode, ForkSteering, ThoughtNode } from "@vitreous/core";
import { useThoughtTree } from "../thought-tree/ThoughtTreeContext.js";
import { DecisionModal, type DecisionModalStage } from "./DecisionModal.js";
import { ExecutionNodeUI } from "./ExecutionNodeUI.js";
import { ConflictNodeUI } from "./ConflictNodeUI.js";

export type SpatialRailProps = {
  "aria-label"?: string;
  className?: string;
};

type ForkConnector = {
  id: string;
  d: string;
  isActive: boolean;
};

const BRANCH_COLUMN_WIDTH = 316;
const BRANCH_COLUMN_GAP = 12;
const ACTIVE_CHAIN_WIDTH = 288;
const INACTIVE_CHAIN_WIDTH = 152;

function truncateLabel(input: string, maxLength = 44): string {
  return input.length > maxLength ? `${input.slice(0, maxLength - 3).trimEnd()}...` : input;
}

function getNodeDisplay(node: ThoughtNode): {
  kicker: string;
  title: string;
  detail?: string;
} {
  if (node.type === "citation") {
    return {
      kicker: "Source",
      title: node.source.title ?? node.source.domain ?? "Citation",
      detail: node.excerpt ?? node.source.uri
    };
  }

  if (node.type === "decision") {
    return {
      kicker: `${Math.round(Math.max(0, Math.min(1, node.confidence)) * 100)}% decision`,
      title: node.claim,
      detail: node.rationale
    };
  }

  if (node.type === "execution") {
    return {
      kicker: "Action",
      title: node.action.summary,
      detail: node.action.kind
    };
  }

  return {
    kicker: node.resolution ? "Resolved conflict" : "Conflict",
    title: node.description ?? "Contradictory data detected",
    detail: `${node.contenders.length} contenders`
  };
}

function areOffsetsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

function areConnectorsEqual(a: ReadonlyArray<ForkConnector>, b: ReadonlyArray<ForkConnector>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].d !== b[i].d || a[i].isActive !== b[i].isActive) {
      return false;
    }
  }
  return true;
}

function getDecisionConfidenceTone(confidence: number): {
  label: string;
  activeClasses: string;
  inactiveClasses: string;
} {
  if (confidence >= 0.85) {
    return {
      label: "very high",
      activeClasses: "border-emerald-300/90 bg-emerald-500/20 text-emerald-100",
      inactiveClasses: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100/55"
    };
  }
  if (confidence >= 0.7) {
    return {
      label: "high",
      activeClasses: "border-lime-300/90 bg-lime-500/18 text-lime-100",
      inactiveClasses: "border-lime-300/35 bg-lime-500/10 text-lime-100/55"
    };
  }
  if (confidence >= 0.5) {
    return {
      label: "medium",
      activeClasses: "border-amber-300/90 bg-amber-500/18 text-amber-100",
      inactiveClasses: "border-amber-300/35 bg-amber-500/10 text-amber-100/55"
    };
  }
  if (confidence >= 0.3) {
    return {
      label: "low",
      activeClasses: "border-orange-300/90 bg-orange-500/18 text-orange-100",
      inactiveClasses: "border-orange-300/35 bg-orange-500/10 text-orange-100/55"
    };
  }
  return {
    label: "very low",
    activeClasses: "border-red-300/90 bg-red-500/18 text-red-100",
    inactiveClasses: "border-red-300/35 bg-red-500/10 text-red-100/55"
  };
}

export function SpatialRail(props: SpatialRailProps) {
  const { className, ...rest } = props;
  const { state, getActiveBranch, getBranchTimeline, switchBranch, forkAtNode } = useThoughtTree();
  const activeBranch = getActiveBranch();
  const branches = React.useMemo(
    () =>
      Object.values(state.branchesById).sort((a, b) => {
        if (a.createdAt === b.createdAt) {
          return a.id.localeCompare(b.id);
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [state.branchesById]
  );
  const branchSlots = React.useMemo(() => {
    const slots: Record<BranchId, number> = {};
    const usedSlots = new Set<number>();

    for (const branch of branches) {
      let candidate = 0;
      if (branch.parentBranchId) {
        candidate = (slots[branch.parentBranchId] ?? 0) - 1;
        while (usedSlots.has(candidate)) {
          candidate -= 1;
        }
      } else {
        while (usedSlots.has(candidate)) {
          candidate += 1;
        }
      }

      slots[branch.id] = candidate;
      usedSlots.add(candidate);
    }

    return slots;
  }, [branches]);
  const spatialBranches = React.useMemo(
    () =>
      [...branches].sort((a, b) => {
        const slotDelta = (branchSlots[a.id] ?? 0) - (branchSlots[b.id] ?? 0);
        if (slotDelta !== 0) {
          return slotDelta;
        }
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [branchSlots, branches]
  );

  const [pendingBranchId, setPendingBranchId] = React.useState<string | null>(null);
  const [isSwitchingBranch, setIsSwitchingBranch] = React.useState(false);
  const [skipSwitchConfirmation, setSkipSwitchConfirmation] = React.useState(false);
  const [doNotAskAgainChecked, setDoNotAskAgainChecked] = React.useState(false);
  const [isForkingNodeId, setIsForkingNodeId] = React.useState<string | null>(null);
  const [hoveredDecisionNodeId, setHoveredDecisionNodeId] = React.useState<string | null>(null);
  const [expandedCitationNodes, setExpandedCitationNodes] = React.useState<Record<string, boolean>>({});
  const [forkConnectors, setForkConnectors] = React.useState<ReadonlyArray<ForkConnector>>([]);
  const [forkConnectorViewport, setForkConnectorViewport] = React.useState({ width: 0, height: 0 });
  const [branchStartOffsets, setBranchStartOffsets] = React.useState<Record<string, number>>({});
  const [modalDecisionId, setModalDecisionId] = React.useState<string | null>(null);
  const [modalStage, setModalStage] = React.useState<DecisionModalStage>("details");
  const [modalSourceBranchId, setModalSourceBranchId] = React.useState<BranchId | null>(null);
  const helpTooltipId = React.useId();

  const railTracksRef = React.useRef<HTMLDivElement | null>(null);
  const branchViewportRef = React.useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const nodeRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const branchLaneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const pendingBranch = pendingBranchId ? state.branchesById[pendingBranchId] : undefined;
  const hoveredDecision = hoveredDecisionNodeId ? state.nodesById[hoveredDecisionNodeId] : undefined;
  const modalDecision = modalDecisionId ? state.nodesById[modalDecisionId] : undefined;
  const modalDecisionCitations = React.useMemo<ReadonlyArray<CitationNode>>(() => {
    if (!modalDecision || modalDecision.type !== "decision") {
      return [];
    }
    return modalDecision.provenance
      .map((citationId) => state.nodesById[citationId])
      .filter((candidate): candidate is CitationNode => Boolean(candidate) && candidate.type === "citation");
  }, [modalDecision, state.nodesById]);
  const highlightedCitationIds = React.useMemo(() => {
    if (!hoveredDecision || hoveredDecision.type !== "decision") {
      return new Set<string>();
    }
    return new Set(hoveredDecision.provenance);
  }, [hoveredDecision]);
  const activeBranchLineage = React.useMemo(() => {
    const lineage = new Set<BranchId>();
    let cursor: BranchId | undefined = activeBranch.id;
    while (cursor) {
      lineage.add(cursor);
      cursor = state.branchesById[cursor]?.parentBranchId;
    }
    return lineage;
  }, [activeBranch.id, state.branchesById]);

  const activeBranchTimelineCount = getBranchTimeline(activeBranch.id).length;
  const previousTimelineCountRef = React.useRef(activeBranchTimelineCount);

  React.useLayoutEffect(() => {
    if (!scrollContainerRef.current) return;
    if (activeBranchTimelineCount > previousTimelineCountRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
    previousTimelineCountRef.current = activeBranchTimelineCount;
  }, [activeBranchTimelineCount, state.activeBranchId]);

  React.useLayoutEffect(() => {
    const viewport = branchViewportRef.current;
    const activeLane = branchLaneRefs.current[activeBranch.id];
    if (!viewport || !activeLane) {
      return;
    }

    const nextLeft = activeLane.offsetLeft + activeLane.offsetWidth / 2 - viewport.clientWidth / 2;
    viewport.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: "smooth"
    });
  }, [activeBranch.id, spatialBranches.length, state.revision]);

  const getNodeRefKey = React.useCallback((branchId: BranchId, nodeId: string) => {
    return `${branchId}:${nodeId}`;
  }, []);

  const getAnyRenderedNodeElement = React.useCallback((nodeId: string) => {
    const suffix = `:${nodeId}`;
    for (const [key, element] of Object.entries(nodeRefs.current)) {
      if (key.endsWith(suffix) && element) {
        return element;
      }
    }
    return null;
  }, []);

  const setNodeRef = React.useCallback((branchId: BranchId, nodeId: string, element: HTMLDivElement | null) => {
    nodeRefs.current[getNodeRefKey(branchId, nodeId)] = element;
  }, [getNodeRefKey]);

  const setBranchLaneRef = React.useCallback((branchId: BranchId, element: HTMLDivElement | null) => {
    branchLaneRefs.current[branchId] = element;
  }, []);

  const getBranchLabel = React.useCallback(
    (branch: (typeof branches)[number]) => {
      if (branch.name && !branch.name.startsWith("Fork from node-")) {
        return branch.name;
      }

      if (branch.forkedFromNodeId) {
        const forkNode = state.nodesById[branch.forkedFromNodeId];
        if (forkNode?.type === "decision") {
          return `Fork: ${truncateLabel(forkNode.claim)}`;
        }
        if (forkNode?.type === "citation") {
          return `Fork: ${truncateLabel(forkNode.source.title ?? forkNode.source.domain ?? "citation")}`;
        }
        if (forkNode) {
          return `Fork: ${forkNode.type}`;
        }
      }

      return branch.name ?? branch.id;
    },
    [branches, state.nodesById]
  );

  const performBranchSwitch = React.useCallback(async (branchId: string) => {
    setIsSwitchingBranch(true);
    await Promise.resolve();
    switchBranch(branchId);
    setIsSwitchingBranch(false);
  }, [switchBranch]);

  const requestBranchSwitch = React.useCallback(
    (branchId: string) => {
      if (branchId === activeBranch.id || isSwitchingBranch) {
        return;
      }
      if (skipSwitchConfirmation) {
        void performBranchSwitch(branchId);
        return;
      }
      setDoNotAskAgainChecked(false);
      setPendingBranchId(branchId);
    },
    [activeBranch.id, isSwitchingBranch, performBranchSwitch, skipSwitchConfirmation]
  );

  const cancelBranchSwitch = React.useCallback(() => {
    if (isSwitchingBranch) {
      return;
    }
    setPendingBranchId(null);
    setDoNotAskAgainChecked(false);
  }, [isSwitchingBranch]);

  const confirmBranchSwitch = React.useCallback(async () => {
    if (!pendingBranchId) {
      return;
    }

    if (doNotAskAgainChecked) {
      setSkipSwitchConfirmation(true);
    }
    await performBranchSwitch(pendingBranchId);
    setPendingBranchId(null);
    setDoNotAskAgainChecked(false);
  }, [doNotAskAgainChecked, pendingBranchId, performBranchSwitch]);

  const openDecisionModal = React.useCallback(
    (branchId: BranchId, nodeId: string, stage: DecisionModalStage) => {
      setModalSourceBranchId(branchId);
      setModalDecisionId(nodeId);
      setModalStage(stage);
    },
    []
  );

  const closeDecisionModal = React.useCallback(() => {
    if (isForkingNodeId) {
      return;
    }
    setModalDecisionId(null);
    setModalSourceBranchId(null);
    setModalStage("details");
  }, [isForkingNodeId]);

  const handleConfirmFork = React.useCallback(
    async (steering: ForkSteering) => {
      if (!modalDecisionId || !modalSourceBranchId) {
        return;
      }
      const targetNodeId = modalDecisionId;
      const targetBranchId = modalSourceBranchId;
      setIsForkingNodeId(targetNodeId);
      await Promise.resolve();
      const hasSteering =
        Boolean(steering.prompt && steering.prompt.length > 0) ||
        Boolean(steering.selectedAlternativeId);
      forkAtNode({
        fromBranchId: targetBranchId,
        nodeId: targetNodeId,
        name:
          modalDecision?.type === "decision"
            ? `Fork: ${truncateLabel(modalDecision.claim)}`
            : `Fork from ${targetNodeId}`,
        steering: hasSteering ? steering : undefined
      });
      setIsForkingNodeId(null);
      setModalDecisionId(null);
      setModalSourceBranchId(null);
      setModalStage("details");
    },
    [forkAtNode, modalDecision, modalDecisionId, modalSourceBranchId]
  );

  const renderNode = React.useCallback(
    (
      node: ThoughtNode,
      tone: "active" | "inactive",
      opts: {
        branchId: BranchId;
        isBranchActive: boolean;
      }
    ) => {
      const isInactive = tone === "inactive";
      const isHighlightedCitation =
        node.type === "citation" && highlightedCitationIds.has(node.id);

      if (isInactive) {
        const display = getNodeDisplay(node);

        return (
          <div className="w-[152px] rounded-[0.8rem] border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-left shadow-none transition group-hover:border-white/[0.14] group-hover:bg-white/[0.04]">
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/28">
              {display.kicker}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-white/42">
              {display.title}
            </p>
            {display.detail ? (
              <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-white/24">
                {display.detail}
              </p>
            ) : null}
          </div>
        );
      }

      if (node.type === "citation") {
        return (
          <div
            className={[
              "w-full max-w-[288px] rounded-[0.85rem] border bg-[#191b20] px-3 py-2.5 text-left shadow-none transition-colors",
              isHighlightedCitation
                ? "border-white/24 bg-[#202228]"
                : "border-white/[0.08]"
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/34">
                Source
              </p>
              <div
                aria-hidden="true"
                className={[
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300",
                  isHighlightedCitation ? "bg-white/72" : "bg-white/22"
                ].join(" ")}
              />
            </div>
            <p className="mt-1 truncate text-[12px] font-medium text-white/72">
              {node.source.title ?? node.source.domain ?? "Citation"}
            </p>
            {node.excerpt ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/36">
                {node.excerpt}
              </p>
            ) : null}
          </div>
        );
      }

      if (node.type === "decision") {
        const confidence = Math.max(0, Math.min(1, node.confidence));
        const confidencePct = Math.round(confidence * 100);
        const decisionTone = getDecisionConfidenceTone(confidence);
        const canFork = opts.isBranchActive && !isInactive;
        const isForkingThisNode = isForkingNodeId === node.id;
        const decisionCitations = node.provenance
          .map((citationId) => state.nodesById[citationId])
          .filter(
            (candidate): candidate is Extract<ThoughtNode, { type: "citation" }> =>
              Boolean(candidate) && candidate.type === "citation"
          );
        const isExpanded = Boolean(expandedCitationNodes[node.id]);
        const hasOverflow = decisionCitations.length > 3;
        const visibleCitations = hasOverflow && !isExpanded ? decisionCitations.slice(0, 2) : decisionCitations;
        const hiddenCount = hasOverflow ? decisionCitations.length - 2 : 0;
        const isHoveredDecision = hoveredDecisionNodeId === node.id;

        return (
          <div
            className="group relative flex flex-col items-center"
            onMouseEnter={() => setHoveredDecisionNodeId(node.id)}
            onMouseLeave={() => setHoveredDecisionNodeId((current) => (current === node.id ? null : current))}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openDecisionModal(opts.branchId, node.id, "details");
              }}
              className={[
                "flex w-full max-w-[288px] flex-col overflow-hidden rounded-[0.95rem] border shadow-none transition-all duration-200",
                isHoveredDecision
                  ? "border-white/18 bg-[#202226]"
                  : "border-white/[0.10] bg-[#1b1d22]",
                "hover:border-white/20 hover:bg-[#22252b]"
              ].join(" ")}
            >
              <div className="flex w-full">
                {/* Confidence Strip */}
                <div 
                  className={`w-1 shrink-0 ${decisionTone.activeClasses.split(" ")[1]}`} 
                  style={{ opacity: confidence * 0.8 + 0.2 }}
                />
                
                <div className="flex-1 p-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold tracking-tight text-white/95 line-clamp-2">
                      {node.claim}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${decisionTone.activeClasses.split(" ")[2]}`}>
                      {confidencePct}%
                    </span>
                  </div>
                  
                  {decisionCitations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
                      {visibleCitations.map((citation) => (
                        <div 
                          key={citation.id}
                          className="flex items-center gap-1 text-[9px] font-medium text-white/40"
                        >
                          <svg className="w-2.5 h-2.5 opacity-40" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                          <span className="truncate max-w-[80px]">
                            {citation.source.domain ?? "source"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        );
/* OLD BLOCK DELETED */
      }

      if (node.type === "execution") {
        return <ExecutionNodeUI node={node} isActive={opts.isBranchActive} />;
      }

      if (node.type === "conflict") {
        return <ConflictNodeUI node={node} isActive={opts.isBranchActive} />;
      }

      return (
        <div
          className={[
            "rounded-full border px-5 py-2 text-sm font-medium shadow-gb-node",
            isInactive
              ? "border-white/30 bg-white/5 text-white/45"
              : "border-white/90 bg-[#141a28] text-white/95"
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {(node as ThoughtNode).type}
        </div>
      );
    },
    [
      expandedCitationNodes,
      highlightedCitationIds,
      hoveredDecisionNodeId,
      isForkingNodeId,
      openDecisionModal,
      state.nodesById
    ]
  );

  const recomputeForkConnectors = React.useCallback(() => {
    const railTracksElement = railTracksRef.current;
    if (!railTracksElement) {
      return;
    }

    const containerRect = railTracksElement.getBoundingClientRect();
    const nextConnectors: ForkConnector[] = [];
    const nextBranchStartOffsets: Record<string, number> = {};

    for (const branch of branches) {
      if (!branch.parentBranchId || !branch.forkedFromNodeId) {
        continue;
      }

      const branchTimeline = getBranchTimeline(branch.id);
      const forkIndex = branchTimeline.findIndex((node) => node.id === branch.forkedFromNodeId);
      const divergentNodes = forkIndex >= 0 ? branchTimeline.slice(forkIndex + 1) : branchTimeline;
      const targetNode = divergentNodes[0] ?? branchTimeline[Math.max(0, forkIndex)];
      if (!targetNode) {
        continue;
      }

      const sourceElement =
        nodeRefs.current[getNodeRefKey(branch.parentBranchId, branch.forkedFromNodeId)] ??
        getAnyRenderedNodeElement(branch.forkedFromNodeId);
      const targetElement = nodeRefs.current[getNodeRefKey(branch.id, targetNode.id)];
      if (!sourceElement || !targetElement) {
        continue;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const targetIsRight = targetRect.left > sourceRect.left;
      const x1 = (targetIsRight ? sourceRect.right : sourceRect.left) - containerRect.left;
      const y1 = sourceRect.top + sourceRect.height * 0.5 - containerRect.top;
      const x2 = (targetIsRight ? targetRect.left : targetRect.right) - containerRect.left;
      const y2 = targetRect.top + targetRect.height * 0.5 - containerRect.top;

      if (Math.abs(x2 - x1) < 48) {
        continue;
      }

      const direction = targetIsRight ? 1 : -1;
      const curveTravel = Math.max(28, Math.abs(x2 - x1) * 0.44);
      const c1x = x1 + direction * curveTravel;
      const c1y = y1;
      const c2x = x2 - direction * curveTravel;
      const c2y = y2;
      const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

      nextConnectors.push({
        id: `${branch.parentBranchId}->${branch.id}`,
        d,
        isActive: activeBranchLineage.has(branch.id)
      });

      const laneElement = branchLaneRefs.current[branch.id];
      if (laneElement) {
        const laneRect = laneElement.getBoundingClientRect();
        const sourceCenterY = sourceRect.top + sourceRect.height * 0.5;
        const offset = Math.max(0, Math.min(280, sourceCenterY - laneRect.top + 16));
        nextBranchStartOffsets[branch.id] = offset;
      }
    }

    const nextViewport = {
      width: Math.max(1, railTracksElement.clientWidth),
      height: Math.max(1, railTracksElement.scrollHeight)
    };

    setForkConnectorViewport((prev) =>
      prev.width === nextViewport.width && prev.height === nextViewport.height ? prev : nextViewport
    );
    setForkConnectors((prev) => (areConnectorsEqual(prev, nextConnectors) ? prev : nextConnectors));
    setBranchStartOffsets((prev) =>
      areOffsetsEqual(prev, nextBranchStartOffsets) ? prev : nextBranchStartOffsets
    );
  }, [activeBranchLineage, branches, getAnyRenderedNodeElement, getBranchTimeline, getNodeRefKey]);

  React.useLayoutEffect(() => {
    recomputeForkConnectors();
  }, [recomputeForkConnectors, state.activeBranchId, state.revision, branchStartOffsets]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.ResizeObserver) return;
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        recomputeForkConnectors();
      });
    });

    if (railTracksRef.current) {
      observer.observe(railTracksRef.current);
    }
    for (const lane of Object.values(branchLaneRefs.current)) {
      if (lane) observer.observe(lane);
    }

    return () => observer.disconnect();
  }, [recomputeForkConnectors, branches.length]);

  React.useEffect(() => {
    const onResize = () => recomputeForkConnectors();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recomputeForkConnectors]);

  return (
    <motion.aside
      ref={scrollContainerRef}
      layout
      {...rest}
      className={[
        "relative sticky top-0 min-h-[100dvh] w-full max-w-5xl overflow-y-auto",
        "bg-[#0f1117] border border-white/10 shadow-gb-rail",
        "rounded-[1.5rem]",
        "p-5 md:p-6",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
          Spatial Rail
        </p>
        <div className="group/help relative shrink-0">
          <button
            type="button"
            aria-label="Show spatial rail help"
            aria-describedby={helpTooltipId}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-xs font-semibold text-white/55 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            ?
          </button>
          <div
            id={helpTooltipId}
            role="tooltip"
            className="pointer-events-none absolute right-0 top-9 z-30 w-72 rounded-[0.85rem] border border-white/12 bg-[#151a24] p-3 text-[12px] leading-5 text-white/70 opacity-0 shadow-gb-rail transition duration-150 group-hover/help:opacity-100 group-focus-within/help:opacity-100"
          >
            Hover a decision badge to view confidence and reveal the fork control. Inactive
            branches are dimmed and stay in fixed lanes; click a branch label or inactive lane to
            switch context.
          </div>
        </div>
      </div>

      <div className="mb-5 border-b border-white/10 pb-4">
        <nav className="flex flex-wrap gap-2" aria-label="Reasoning branches">
          {spatialBranches.map((branch) => {
            const isActive = branch.id === activeBranch.id;
            const canSwitchToBranch = !isActive && !isSwitchingBranch;

            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => requestBranchSwitch(branch.id)}
                disabled={!canSwitchToBranch}
                aria-current={isActive ? "true" : undefined}
                className={[
                  "inline-flex min-h-8 max-w-[220px] items-center rounded-full border px-3 text-[12px] font-medium transition",
                  isActive
                    ? "border-white/22 bg-white/[0.08] text-white/90"
                    : "border-white/10 bg-white/[0.02] text-white/42 hover:border-white/24 hover:text-white/72",
                  isSwitchingBranch ? "cursor-not-allowed opacity-60" : "",
                  !canSwitchToBranch ? "cursor-default" : "active:scale-[0.98]"
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="truncate">{getBranchLabel(branch)}</span>
              </button>
            );
          })}
        </nav>
        {skipSwitchConfirmation ? (
          <button
            type="button"
            onClick={() => setSkipSwitchConfirmation(false)}
            className="mt-3 inline-flex items-center rounded-full border border-white/20 px-2.5 py-1 text-left text-[11px] font-medium text-white/75 transition hover:border-white/40 hover:text-white active:scale-[0.98]"
          >
            Confirmation prompts are off. Click to re-enable.
          </button>
        ) : null}
      </div>

      <div 
        ref={branchViewportRef}
        className="overflow-x-auto overflow-y-visible pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitMaskImage: branches.length > 1 ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)" : "none", 
          maskImage: branches.length > 1 ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)" : "none" 
        }}
      >
        <div ref={railTracksRef} className="relative flex w-max min-w-full items-start px-[160px]" style={{ gap: `${BRANCH_COLUMN_GAP}px` }}>
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={forkConnectorViewport.width}
            height={forkConnectorViewport.height}
            viewBox={`0 0 ${forkConnectorViewport.width} ${forkConnectorViewport.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="fork-active-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {forkConnectors.map((connector) =>
              connector.isActive ? (
                <g key={connector.id}>
                  <path
                    d={connector.d}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.12)"
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                  <path
                    d={connector.d}
                    fill="none"
                    stroke="rgba(220, 220, 220, 0.58)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </g>
              ) : (
                <path
                  key={connector.id}
                  d={connector.d}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                />
              )
            )}
          </svg>

          <div className="contents">
          {spatialBranches.map((branch) => {
            const isActive = branch.id === activeBranch.id;
            const branchTimeline = getBranchTimeline(branch.id);
            const forkIndex = branch.forkedFromNodeId
              ? branchTimeline.findIndex((node) => node.id === branch.forkedFromNodeId)
              : -1;
            const visibleNodes = isActive
              ? branchTimeline
              : forkIndex < 0
                ? branchTimeline
                : branchTimeline.slice(forkIndex + 1);

            const canSwitchToBranch = !isActive;

            return (
              <div
                key={branch.id}
                ref={(element) => setBranchLaneRef(branch.id, element)}
                onClick={() => {
                  if (canSwitchToBranch) {
                    requestBranchSwitch(branch.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (!canSwitchToBranch) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    requestBranchSwitch(branch.id);
                  }
                }}
                role={canSwitchToBranch ? "button" : undefined}
                tabIndex={canSwitchToBranch ? 0 : undefined}
                className={[
                  "group shrink-0 text-left transition-opacity duration-300 ease-out",
                  isActive ? "relative z-20" : "relative z-10"
                ].join(" ")}
                style={{ width: `${BRANCH_COLUMN_WIDTH}px` }}
                aria-label={canSwitchToBranch ? `Switch to branch ${branch.id}` : undefined}
              >
                <div
                  className={[
                    "mx-auto transition-all duration-300 ease-out",
                    isActive
                      ? "opacity-100"
                      : "scale-[0.94] opacity-35 grayscale hover:opacity-65 hover:grayscale-0",
                    isSwitchingBranch ? "cursor-not-allowed opacity-60" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    width: `${isActive ? ACTIVE_CHAIN_WIDTH : INACTIVE_CHAIN_WIDTH}px`
                  }}
                >
                  <div className="space-y-0">
                    <AnimatePresence mode="popLayout">
                      {visibleNodes.length > 0 ? (
                        <div style={{ paddingTop: `${isActive ? 0 : branchStartOffsets[branch.id] ?? 0}px` }}>
                          {visibleNodes.map((node, index) => (
                            <motion.div
                              layout
                              key={node.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="flex flex-col items-center"
                            >
                              <div ref={(element) => setNodeRef(branch.id, node.id, element)} className="inline-flex">
                                {renderNode(node, isActive ? "active" : "inactive", {
                                  branchId: branch.id,
                                  isBranchActive: isActive
                                })}
                              </div>
                              {index < visibleNodes.length - 1 ? (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: 32 }}
                                  transition={{ duration: 0.3, ease: "easeOut" }}
                                  className={isActive ? "w-px bg-[#d9b266]/80" : "w-px bg-white/25"}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-center"
                          style={{ paddingTop: `${isActive ? 0 : branchStartOffsets[branch.id] ?? 0}px` }}
                        >
                          {branch.forkedFromNodeId ? (
                            <div
                              ref={(element) => setNodeRef(branch.id, branch.forkedFromNodeId!, element)}
                              className={[
                                "inline-flex max-w-[168px] items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors duration-500",
                                isActive
                                  ? "border-[#e0bc78]/50 bg-[#e0bc78]/10 text-[#e0bc78] shadow-[0_0_12px_rgba(224,188,120,0.15)]"
                                  : "border-white/20 bg-white/[0.02] text-white/55"
                              ].join(" ")}
                            >
                              <span className={`shrink-0 uppercase tracking-[0.16em] transition-colors ${isActive ? "text-[#e0bc78]/60" : "text-white/40"}`}>
                                fork
                              </span>
                              <span className="min-w-0 truncate">
                                {(() => {
                                  const forkNode = state.nodesById[branch.forkedFromNodeId!];
                                  if (!forkNode) {
                                    return "origin";
                                  }
                                  if (forkNode.type === "decision") {
                                    return forkNode.claim;
                                  }
                                  if (forkNode.type === "citation") {
                                    return forkNode.source.domain ?? forkNode.source.title ?? "citation";
                                  }
                                  return forkNode.type;
                                })()}
                              </span>
                            </div>
                          ) : null}
                          <div className="px-2 py-1 text-xs text-white/30">No divergent nodes yet</div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingBranch && (
          <motion.div
            key="branch-switch-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[1rem] border border-white/15 bg-[#121722] p-4 shadow-gb-rail"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm branch switch"
            >
              <h2 className="text-sm font-semibold tracking-tight text-white">Switch branch?</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Switch from <span className="text-white">{activeBranch.id}</span> to{" "}
                <span className="text-white">{pendingBranch.id}</span>. This may briefly pause while
                the active context updates.
              </p>
              <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={doNotAskAgainChecked}
                  onChange={(event) => setDoNotAskAgainChecked(event.currentTarget.checked)}
                  className="h-4 w-4 rounded border-gb-rail-border bg-transparent"
                />
                Don't ask again for this session
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={cancelBranchSwitch}
                  disabled={isSwitchingBranch}
                  className="rounded-[0.75rem] border border-white/20 px-3 py-2 text-sm text-white/85 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBranchSwitch}
                  disabled={isSwitchingBranch}
                  className="rounded-[0.75rem] border border-emerald-300/50 bg-emerald-500 px-3 py-2 text-sm font-semibold text-[#08110a] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  {isSwitchingBranch ? "Switching..." : "Confirm switch"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {modalDecision && modalDecision.type === "decision" ? (
        <DecisionModal
          open={Boolean(modalDecisionId)}
          decision={modalDecision}
          citations={modalDecisionCitations}
          initialStage={modalStage}
          isForking={isForkingNodeId === modalDecisionId}
          onClose={closeDecisionModal}
          onConfirmFork={handleConfirmFork}
        />
      ) : null}
    </motion.aside>
  );
}
