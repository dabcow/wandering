import type { Mood } from "./moods";

export type Attribute = {
  id: string;
  label: string;
  /** 0–100 */
  value: number;
};

/** Another take on a cell's paragraph, written by the writer in its rabbit hole. */
export type Alternate = {
  id: string;
  text: string;
};

/**
 * One section of the piece. It begins as an outline note (heading + intent);
 * once the writer clicks it, they write the paragraph and the note stays
 * beside it as a guide.
 */
export type Cell = {
  id: string;
  heading: string;
  intent: string;
  mood: Mood;
  /** False while the cell is still only an outline note. */
  started: boolean;
  /** The writer's paragraph. */
  text: string;
  alternates: Alternate[];
};

export const STEPS = ["idea", "style", "outline"] as const;
export type Step = (typeof STEPS)[number];

export type Project = {
  version: 2;
  step: Step;
  idea: string;
  attributes: Attribute[];
  /** 0–100: outline length relative to the idea. */
  length: number;
  title: string;
  cells: Cell[];
};
