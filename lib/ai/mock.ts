import { targetSections } from "../length";
import type { Mood } from "../moods";
import type { AIProvider } from "./provider";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SECTIONS: { heading: string; intent: string; mood: Mood }[] = [
  { heading: "Opening", intent: "Draw the reader in and say what this piece is about.", mood: "warm" },
  { heading: "Background", intent: "Give the context the reader needs.", mood: "calm" },
  { heading: "The problem", intent: "Name what is not working and why it matters.", mood: "tense" },
  { heading: "Main point", intent: "Make the central point of the idea.", mood: "bold" },
  { heading: "An example", intent: "Show the point with one concrete case.", mood: "playful" },
  { heading: "Looking back", intent: "Reflect on how things got here.", mood: "reflective" },
  { heading: "What changes", intent: "Describe what will be different.", mood: "hopeful" },
  { heading: "Close", intent: "Wrap up and leave the reader with a next step.", mood: "joyful" },
];

/**
 * Canned output for trying the interface without a key (AI_PROVIDER=mock).
 * It makes no attempt to plan well; it only exercises the flow.
 */
export function createMockProvider(): AIProvider {
  return {
    name: "mock",

    async generateOutline(idea, _attributes, length) {
      await pause(600);
      const words = idea.trim().split(/\s+/).slice(0, 7).join(" ");
      const count = targetSections(idea, length);
      return {
        title: `${words.charAt(0).toUpperCase()}${words.slice(1)}`.replace(/[.,;:!?]+$/, ""),
        sections: Array.from({ length: count }, (_, i) => {
          // Always end on the closing section.
          const section = i === count - 1 ? SECTIONS[SECTIONS.length - 1] : SECTIONS[i % (SECTIONS.length - 1)];
          return { ...section };
        }),
      };
    },
  };
}
