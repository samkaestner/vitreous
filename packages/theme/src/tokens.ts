export type VitreousTokens = {
  color: {
    rail: {
      bg: string;
      border: string;
      muted: string;
    };
    node: {
      citation: {
        bg: string;
        border: string;
        text: string;
      };
      decision: {
        hi: string;
        lo: string;
        text: string;
      };
      execution: {
        bg: string;
        border: string;
        text: string;
      };
      conflict: {
        bg: string;
        border: string;
        text: string;
      };
    };
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
  };
  shadow: {
    rail: string;
    node: string;
  };
};

export const tokens: VitreousTokens = {
  color: {
    rail: {
      bg: "#0b0f19",
      border: "rgba(255,255,255,0.10)",
      muted: "rgba(255,255,255,0.60)"
    },
    node: {
      citation: {
        bg: "#0f172a",
        border: "rgba(255,255,255,0.12)",
        text: "rgba(255,255,255,0.92)"
      },
      decision: {
        hi: "#16a34a",
        lo: "#f97316",
        text: "rgba(255,255,255,0.92)"
      },
      execution: {
        bg: "#111827",
        border: "rgba(255,255,255,0.18)",
        text: "rgba(255,255,255,0.92)"
      },
      conflict: {
        bg: "#1f0a0a",
        border: "rgba(239,68,68,0.45)",
        text: "rgba(255,255,255,0.92)"
      }
    }
  },
  radius: {
    sm: "10px",
    md: "14px",
    lg: "18px"
  },
  shadow: {
    rail: "0 16px 40px rgba(0,0,0,0.45)",
    node: "0 10px 26px rgba(0,0,0,0.35)"
  }
};

