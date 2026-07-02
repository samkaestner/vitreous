"use server";

import fs from "fs/promises";
import path from "path";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import type { AddNodeInput } from "@glassbox/core";
import {
  REPLAY_LATENCY_MS,
  demoContinuationResponse,
  demoInitialResponse
} from "./demo-script";

const ai = new GoogleGenAI({}); // Relies on GEMINI_API_KEY env var

// Replay mode: with no API key (or when forced), the actions return scripted
// responses instead of calling the model. The supervision flow on the client
// is identical — only the LLM is canned. This is what the hosted demo runs.
const isReplayMode = () =>
  process.env.GLASSBOX_DEMO_MODE === "1" || !process.env.GEMINI_API_KEY;

const simulateModelLatency = () =>
  new Promise((resolve) => setTimeout(resolve, REPLAY_LATENCY_MS));

// Define the expected output schema for the LLM
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nodeType: {
      type: Type.STRING,
      enum: ["decision", "conflict"],
      description: "Return 'decision' if you can synthesize an answer. Return 'conflict' if the provided context documents fundamentally disagree."
    },
    decisionPayload: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        claim: { type: Type.STRING, description: "The core assertion or answer." },
        confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0." },
        rationale: { type: Type.STRING, description: "Detailed explanation of why this decision was made." },
        provenanceUris: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "An array of the file URIs (e.g. 'file:///study-1.md') that support this decision."
        },
        alternatives: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    },
    conflictPayload: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        description: { type: Type.STRING, description: "Explanation of exactly what the conflict is between the documents." },
        contenderUris: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "An array of the file URIs that disagree."
        }
      }
    }
  },
  required: ["nodeType"]
};

export async function askGlassBox(query: string) {
  // 1. Read local .md files
  const dataDir = path.join(process.cwd(), "src/data");
  let files: string[] = [];
  try {
    files = await fs.readdir(dataDir);
  } catch {
    // Directory might not exist yet
    await fs.mkdir(dataDir, { recursive: true });
  }

  const citations: AddNodeInput[] = [];
  let systemContext = "You are an AI assistant. Use the following context documents to answer the user's query.\n\n";

  for (const file of files) {
    if (file.endsWith(".md")) {
      const content = await fs.readFile(path.join(dataDir, file), "utf-8");
      const uri = `file:///${file}`;
      
      systemContext += `--- Document: ${uri} ---\n${content}\n\n`;
      
      citations.push({
        type: "citation",
        source: {
          kind: "file",
          uri,
          title: file
        },
        excerpt: content.substring(0, 150) + "..."
      });
    }
  }

  // 2. Replay mode: skip the model, return the scripted conflict
  if (isReplayMode()) {
    await simulateModelLatency();
    return {
      citations,
      llmResponse: demoInitialResponse(),
      mode: "replay" as const
    };
  }

  // 2b. Call Gemini
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: query,
    config: {
      systemInstruction: systemContext,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from LLM");

  const result = JSON.parse(text);

  // 3. Return the parsed result along with the citations so the client can build the DAG
  return {
    citations,
    llmResponse: result,
    mode: "live" as const
  };
}

// Schema that ONLY allows a decision — no conflict option
const continuationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    nodeType: {
      type: Type.STRING,
      enum: ["decision"],
      description: "You must return a synthesized decision."
    },
    decisionPayload: {
      type: Type.OBJECT,
      properties: {
        claim: { type: Type.STRING, description: "The core assertion or answer, incorporating the user's preference." },
        confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0." },
        rationale: { type: Type.STRING, description: "Detailed explanation. Reference both sources but explain why the chosen source is weighted more heavily." },
        provenanceUris: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "An array of the file URIs that support this decision."
        },
        alternatives: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    }
  },
  required: ["nodeType", "decisionPayload"]
};

export async function askGlassBoxContinuation(
  originalQuery: string,
  chosenLabel: string,
  conflictDescription: string
) {
  // Replay mode: return the scripted synthesis weighted to the user's choice
  if (isReplayMode()) {
    await simulateModelLatency();
    return demoContinuationResponse(chosenLabel);
  }

  // 1. Read local .md files for context (the LLM still needs both to weigh them)
  const dataDir = path.join(process.cwd(), "src/data");
  let files: string[] = [];
  try {
    files = await fs.readdir(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  let systemContext = `You are an AI assistant continuing a research synthesis.

IMPORTANT: A conflict was previously detected between the context documents. The user has reviewed both sides and resolved the conflict by choosing to prioritize: "${chosenLabel}".

The original conflict was: "${conflictDescription}"

You MUST now synthesize a final answer that:
1. Primarily weighs the user's chosen source
2. Acknowledges relevant data from the other source(s) where it does not contradict the chosen direction
3. Provides a clear, actionable conclusion

Do NOT report another conflict. The conflict is resolved. Produce a decision.

Context documents:
`;

  for (const file of files) {
    if (file.endsWith(".md")) {
      const content = await fs.readFile(path.join(dataDir, file), "utf-8");
      systemContext += `--- Document: file:///${file} ---\n${content}\n\n`;
    }
  }

  // 2. Call Gemini with the decision-only schema
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: `Original question: ${originalQuery}\n\nThe user chose to prioritize "${chosenLabel}". Synthesize your final answer now.`,
    config: {
      systemInstruction: systemContext,
      responseMimeType: "application/json",
      responseSchema: continuationSchema,
      temperature: 0.2
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from LLM");

  return JSON.parse(text);
}
