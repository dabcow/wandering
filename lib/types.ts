import type { JSONContent } from "@tiptap/core";

export type Plot = "main" | "b";

/** One step of the guide rail: the intended arc, one beat per tree level. */
export type Beat = {
  title: string;
  description: string;
};

/** A plot point the writer has chosen (or written) and that is part of the tree. */
export type PlotNode = {
  id: string;
  /** Null for a first-level node. */
  parentId: string | null;
  /** 1-based depth; equals the guide-rail beat it sits under. */
  level: number;
  title: string;
  summary: string;
  source: "ai" | "user";
  isEnding: boolean;
  plot: Plot;
  /**
   * Which telling of the story this plot point continues. The first plot
   * point chosen under a parent carries on the parent's branch; each later
   * one starts a branch of its own. Writing no longer depends on it (each
   * plot point has one text); it is kept to fold in writing from saves made
   * while each branch had its own copy.
   */
  branch: string;
};

/** An AI suggestion for a plot point. It becomes a PlotNode (same id) when chosen. */
export type Candidate = {
  id: string;
  title: string;
  summary: string;
  isEnding: boolean;
};

/** A point where the B plot meets the main plot. */
export type Link = {
  mainId: string;
  bId: string;
};

export const STEPS = ["idea", "tree", "write", "review"] as const;
export type Step = (typeof STEPS)[number];

export type Project = {
  version: 3;
  /** Which project in this browser's library this is. */
  id: string;
  step: Step;
  idea: string;
  /** 0 (slow burn) to 100 (fast). */
  pacing: number;
  title: string;
  /**
   * The suggested outline. Empty until generated, and stays empty when the
   * writer starts from scratch: then the story has no expected number of beats.
   * Otherwise its length is the tree's target depth.
   */
  guideRail: Beat[];
  /**
   * The idea with its typos tidied by the AI, shown as the Plot reminder in
   * the Tree step. `from` is the idea text it was made from, so it is redone
   * when the idea changes. Null until made.
   */
  plotSummary: { from: string; text: string } | null;
  nodes: PlotNode[];
  /** Suggestions per parent, keyed by groupKey(plot, parentId). */
  candidates: Record<string, Candidate[]>;
  links: Link[];
  /** Null until the writer adds a B plot. */
  bPlot: { premise: string } | null;
  /** The leaf whose root-to-leaf path the document currently tells, per plot. */
  activeLeaf: Record<Plot, string | null>;
  /** Blocks written before the first plot point's anchor (TipTap JSON). */
  intro: JSONContent[];
  /**
   * The writing: the blocks under each plot point's heading, keyed by node
   * id. A plot point has this one text on every branch it is part of. The
   * editor shows only the sections of the branch being told.
   */
  sections: Record<string, JSONContent[]>;
};
