import { describeAttribute } from "./prompts";
import type { AIProvider } from "./provider";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Canned output for trying the interface without a key (AI_PROVIDER=mock).
 * It makes no attempt to write well; it only exercises the flow.
 */
export function createMockProvider(): AIProvider {
  let round = 0;

  return {
    name: "mock",

    async generateOutline(idea) {
      await pause(600);
      const words = idea.trim().split(/\s+/).slice(0, 7).join(" ");
      return {
        title: `${words.charAt(0).toUpperCase()}${words.slice(1)}`.replace(/[.,;:!?]+$/, ""),
        sections: [
          { heading: "Opening", intent: "Draw the reader in and say what this piece is about." },
          { heading: "Background", intent: "Give the context the reader needs." },
          { heading: "Main point", intent: "Make the central point of the idea." },
          { heading: "Close", intent: "Wrap up and leave the reader with a next step." },
        ],
      };
    },

    async generateDrafts(_idea, outline, attributes) {
      await pause(900);
      const style = attributes.map((a) => describeAttribute(a)).join("; ");
      return outline.sections.map(
        (section, i) =>
          `Mock paragraph ${i + 1} for "${section.heading}". ${section.intent || "No intent given."} A real provider would write this in the chosen style (${style}).`,
      );
    },

    async generateAlternatives(paragraph, _context, _attributes, n) {
      await pause(700);
      round += 1;
      const openers = ["Put another way", "Seen from the other side", "More bluntly", "As a question", "In short"];
      return Array.from(
        { length: n },
        (_, i) => `${openers[i % openers.length]} (mock ${round}.${i + 1}): ${paragraph}`,
      );
    },
  };
}
