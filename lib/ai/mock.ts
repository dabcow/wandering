import { depthForPacing } from "../tree";
import type { AIProvider } from "./provider";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ARC = [
  ["Introduction", "Show the world and who we are following."],
  ["Disturbance", "Something breaks the usual order."],
  ["First step", "The lead commits to doing something about it."],
  ["Complication", "The obvious plan stops working."],
  ["Allies and rivals", "Others take sides."],
  ["Midpoint turn", "What the story is really about comes into view."],
  ["Pressure", "The cost of going on rises."],
  ["Setback", "The lead loses something that mattered."],
  ["Regrouping", "A new way forward is found."],
  ["Approach", "Everything lines up for the final attempt."],
  ["Climax", "The central question is decided."],
  ["Ending", "Show what has changed."],
];

const MOVES = [
  ["An escalation", "The stakes rise sharply."],
  ["A reversal", "What looked true turns out to be the opposite."],
  ["A reveal", "A hidden fact comes out."],
  ["A complication", "A new obstacle gets in the way."],
  ["A quiet turn", "A small choice changes the direction."],
];

/**
 * Canned output for trying the interface without a key (AI_PROVIDER=mock).
 * It makes no attempt to plot well; it only exercises the flow.
 */
export function createMockProvider(): AIProvider {
  let round = 0;

  return {
    name: "mock",

    async generateGuideRail(idea, pacing) {
      await pause(500);
      const depth = depthForPacing(pacing);
      const words = idea.trim().split(/\s+/).slice(0, 6).join(" ");
      // Spread the canned arc across however many levels the pacing asks for.
      const beats = Array.from({ length: depth }, (_, i) => {
        const [title, description] = ARC[Math.round((i * (ARC.length - 1)) / Math.max(1, depth - 1))];
        return { title, description };
      });
      return {
        title: `${words.charAt(0).toUpperCase()}${words.slice(1)}`.replace(/[.,;:!?]+$/, ""),
        beats,
      };
    },

    async generateOptions(input) {
      await pause(500);
      round += 1;
      // From scratch there is no planned length; pretend one so endings still turn up eventually.
      const depth = input.guideRail.length || 8;
      const level = input.path.length + 1;
      const parent = input.path[input.path.length - 1]?.title;
      return Array.from({ length: input.count }, (_, i) => {
        const [title, summary] = MOVES[(i + round) % MOVES.length];
        const isEnding = level >= depth && i < input.count - 1;
        return {
          title: isEnding ? `Ending ${round}.${i + 1}` : `${title} ${round}.${i + 1}`,
          summary: `${isEnding ? "The story closes here." : summary} (Mock ${input.plot === "b" ? "B plot" : "main plot"} option for level ${level}${parent ? `, after "${parent}"` : ""}.)`,
          isEnding,
        };
      });
    },

    async tidyIdea(idea) {
      await pause(300);
      const text = idea.trim().replace(/\s+/g, " ");
      return text.charAt(0).toUpperCase() + text.slice(1);
    },

    async generateBPlotPremise() {
      await pause(400);
      return "Mock B plot: a minor character pursues a small goal of their own, which keeps crossing the main story at awkward moments.";
    },
  };
}
