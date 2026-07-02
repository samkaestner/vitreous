// Scripted responses for replay mode — the playground's no-API-key fallback.
// Mirrors the shapes the live Gemini calls return in actions.ts so the client
// orchestration (conflict arbitration, execution gate, forking) is identical
// in both modes. Only the model is canned; the supervision flow is real.

export const REPLAY_LATENCY_MS = 850;

export type DemoDecisionPayload = {
  claim: string;
  confidence: number;
  rationale: string;
  provenanceUris: string[];
  alternatives: Array<{ id: string; label: string; description: string }>;
};

export function demoInitialResponse() {
  return {
    nodeType: "conflict" as const,
    conflictPayload: {
      description:
        "The context documents fundamentally disagree on training intensity distribution. " +
        "'hiit-study.md' recommends 60%+ high-intensity interval work and describes Zone 2 volume as an " +
        "inefficient use of time for non-elite athletes, while 'zone2-study.md' recommends the opposite: an " +
        "80/20 split dominated by low-intensity Zone 2 volume, citing superior mitochondrial density and " +
        "aerobic base gains. These recommendations cannot both anchor the same training plan.",
      contenderUris: ["file:///hiit-study.md", "file:///zone2-study.md"]
    },
    decisionPayload: null
  };
}

export function demoContinuationResponse(chosenLabel: string): {
  nodeType: "decision";
  decisionPayload: DemoDecisionPayload;
} {
  const choseHiit = /hiit/i.test(chosenLabel);

  if (choseHiit) {
    return {
      nodeType: "decision",
      decisionPayload: {
        claim:
          "Structure your week around high-intensity work: roughly 60% of training volume as threshold and " +
          "VO2 max intervals (Zone 4–5), with the remainder as easy recovery riding. Anchor the plan on two " +
          "quality interval days and one longer threshold session, and treat easy volume as recovery rather " +
          "than as a primary training stimulus.",
        confidence: 0.78,
        rationale:
          "You resolved the intensity-distribution conflict in favour of the HIIT meta-analysis, so this plan " +
          "weights its findings: rapid, sustained VO2 max gains from majority high-intensity volume over a " +
          "12-week block. The Zone 2 study's mitochondrial-density findings are acknowledged where they do not " +
          "contradict the chosen direction — easy volume is retained for recovery, just not as the main driver. " +
          "Confidence is moderated because the HIIT study's strongest claims apply to non-elite athletes on " +
          "compressed timelines.",
        provenanceUris: ["file:///hiit-study.md", "file:///zone2-study.md"],
        alternatives: [
          {
            id: "alt-polarized",
            label: "Polarized 80/20 split",
            description:
              "Keep most volume easy and concentrate intensity into fewer, harder sessions — the zone2-study.md position."
          },
          {
            id: "alt-pyramidal",
            label: "Pyramidal distribution",
            description:
              "A middle path: mostly easy volume, a meaningful tempo/threshold band, and a small top of high intensity."
          }
        ]
      }
    };
  }

  return {
    nodeType: "decision",
    decisionPayload: {
      claim:
        "Structure your training around an 80/20 polarized split: roughly 80% of weekly volume as low-intensity " +
        "Zone 2 riding to build aerobic base, capillary density, and mitochondrial adaptations, with the " +
        "remaining 20% as focused high-intensity sessions to retain top-end fitness.",
      confidence: 0.86,
      rationale:
        "You resolved the intensity-distribution conflict in favour of the Zone 2 study, so this plan weights " +
        "its findings: a 12% greater increase in mitochondrial density for the 80/20 group and the aerobic base " +
        "required for sustained endurance pacing. The HIIT meta-analysis is not discarded — its evidence that " +
        "high-intensity work drives VO2 max is why the plan keeps a 20% intensity share rather than going " +
        "fully easy. Confidence is high because the chosen study's protocol matches the endurance-event " +
        "preparation in your question.",
      provenanceUris: ["file:///zone2-study.md", "file:///hiit-study.md"],
      alternatives: [
        {
          id: "alt-hiit-majority",
          label: "HIIT-majority split",
          description:
            "Invert the ratio: 60%+ high-intensity threshold and interval work — the hiit-study.md position."
        },
        {
          id: "alt-pyramidal",
          label: "Pyramidal distribution",
          description:
            "A middle path: mostly easy volume, a meaningful tempo/threshold band, and a small top of high intensity."
        }
      ]
    }
  };
}
