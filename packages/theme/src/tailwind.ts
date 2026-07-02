import type { Config } from "tailwindcss";
import { tokens } from "./tokens.js";

/**
 * Tailwind preset for Vitreous.
 * Consumers can include it in their Tailwind config via:
 * `presets: [vitreousTailwindPreset]`
 */
export const vitreousTailwindPreset: Pick<Config, "theme"> = {
  theme: {
    extend: {
      borderRadius: {
        "gb-sm": tokens.radius.sm,
        "gb-md": tokens.radius.md,
        "gb-lg": tokens.radius.lg
      },
      boxShadow: {
        "gb-rail": tokens.shadow.rail,
        "gb-node": tokens.shadow.node
      },
      colors: {
        gb: {
          rail: {
            bg: tokens.color.rail.bg,
            border: tokens.color.rail.border,
            muted: tokens.color.rail.muted
          },
          node: {
            citation: {
              bg: tokens.color.node.citation.bg,
              border: tokens.color.node.citation.border,
              text: tokens.color.node.citation.text
            },
            decision: {
              hi: tokens.color.node.decision.hi,
              lo: tokens.color.node.decision.lo,
              text: tokens.color.node.decision.text
            },
            execution: {
              bg: tokens.color.node.execution.bg,
              border: tokens.color.node.execution.border,
              text: tokens.color.node.execution.text
            },
            conflict: {
              bg: tokens.color.node.conflict.bg,
              border: tokens.color.node.conflict.border,
              text: tokens.color.node.conflict.text
            }
          }
        }
      }
    }
  }
};

