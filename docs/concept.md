# 

"Glass Box" UX Framework: AI Transparency Components

This document outlines the architectural and experiential guidelines for the "Glass Box" component library. Designed to bridge the gap between probabilistic AI systems and human-centered design, the framework provides developers with out-of-the-box UI patterns that handle uncertainty, visualize reasoning, and build user trust.

## **Component 01: Modular Chain-of-Thought (The Spatial Rail)**

A persistent, right-rail overlay that acts as a spatial canvas—conceptually similar to a vertical FigJam board. It demystifies the AI's internal processing by breaking down its generation process into a scorable, scrollable timeline of discrete nodes.

### **Node Typology & Styling**

| Node Type | Visual Treatment | Data State / Confidence | User Purpose |
| :---- | :---- | :---- | :---- |
| **Citation / Source** | White box, distinct borders, rigid geometry, neutral typography. Web sources feature domain favicons or globe icons. | Neutral (N/A). Grounded data. | Allows the user to inspect the exact retrieved context. |
| **Decision / Inference** | Solid or gradient fill. Color mapping tied directly to the model's token probability. | Variable (e.g., Cool tones for High Confidence, Warm tones for Low Confidence/Extrapolation). | Highlights logical leaps or data synthesis. |
| **Execution / Action** | High-contrast outlined box with actionable buttons. | Pending User Authorization. | Halts the system before executing a state-changing event. |
| **Conflict / Clash** | Y-junction split in the rail with warning colors. | System Halted: Contradictory Data Detected. | Forces manual resolution of opposing data points. |

## **Component 02: Confidence Provenance & Visual Grounding**

Demystifying numerical confidence scores by explicitly linking them to their underlying sources through interactive visual highlighting. Hovering over a Decision node dynamically highlights the contributing Citation nodes in the spatial rail.

## **Component 03: Agentic Action Guardrails**

Translating the proven security patterns of developer coding agents into accessible UI components for end-users when an AI attempts a state-changing action (e.g., mutating a database, calling an external API).

### **The Execution Gate**

When the AI determines an action is necessary, it generates an Execution Node in the spatial rail. The main chat stream pauses until the user resolves the gate via three distinct interaction paths:

* **Allow Once:** Permits the payload to execute for this specific instance, keeping the human firmly in the loop for future occurrences.  
* **Always Allow:** Whitelists the specific action type and parameter structure for the duration of the session, reducing friction for repetitive tasks.  
* **Modify / Reject:** Provides an inline editor to manually adjust the AI's proposed payload before execution, or entirely cancel the action.

## **Component 04: Conflict Resolution UI**

Surfacing and resolving contradictory data pulled during the retrieval phase before it pollutes the final generation.

### **The Synthesis Clash**

1. **Visual Bifurcation:** When the system retrieves two or more sources that fundamentally disagree, the spatial rail visually splits into a Y-junction (a Conflict Node), immediately halting the generation stream.  
2. **Side-by-Side Evaluation:** The main window presents a direct, highlighted comparison of the conflicting text snippets, removing the need for the user to hunt through dense documents.  
3. **Manual Resolution:** The user acts as the final arbiter. They can click to designate one source as authoritative (collapsing the Y-junction into a single active branch), discard both, or use the steering prompt to inject a custom synthesis.

## **State Management & Conversational Forking Logic**

The framework abstracts standard linear chat arrays into a tree-based Directed Acyclic Graph (DAG) state architecture. Users can hover over any node, select "Fork here," and inject localized steering prompts or new sources. The UI actively manages these branches via visual scale, saturation, and confirmation modals to prevent user disorientation.

## **Architecture & Implementation Notes**

// Example Hook Architecture  
const { nodes, forkAtNode, activeBranch, resolveConflict } \= useThoughtTree({  
  initialPrompt: "Analyze the dataset",  
  onFork: (nodeId, newParams, newSource) \=\> handleBranching(nodeId, newParams, newSource),  
  onConflict: (sourceA, sourceB) \=\> triggerClashUI(sourceA, sourceB)  
});  
