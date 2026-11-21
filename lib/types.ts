export type Attribute = {
  id: string;
  label: string;
  /** 0–100 */
  value: number;
};

export type OutlineSection = {
  id: string;
  heading: string;
  intent: string;
};

export type Outline = {
  title: string;
  sections: OutlineSection[];
};

export type Cell = {
  id: string;
  /** Section label shown above the cell. Not exported. */
  heading: string;
  text: string;
  /** Earlier versions of this cell's text, oldest first. */
  history: string[];
};

export const STEPS = ["idea", "style", "outline", "cells"] as const;
export type Step = (typeof STEPS)[number];

export type Project = {
  version: 1;
  step: Step;
  idea: string;
  attributes: Attribute[];
  outline: Outline | null;
  cells: Cell[];
};
