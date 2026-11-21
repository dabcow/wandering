"use client";

import type { JSONContent } from "@tiptap/core";
import { useEffect, useReducer, useState } from "react";
import { emptyProject, loadProject, saveProject } from "./storage";
import { branchFor, groupKey, subtreeIds } from "./tree";
import type { Beat, Candidate, Link, Plot, PlotNode, Project, Step } from "./types";

export { newId } from "./id";

export type Action =
  | { type: "hydrate"; project: Project }
  | { type: "setStep"; step: Step }
  | { type: "setIdea"; idea: string }
  | { type: "setPacing"; pacing: number }
  | { type: "setTitle"; title: string }
  /** A new guide rail starts a new tree: nodes, suggestions, links and the B plot are cleared. */
  | { type: "setGuideRail"; title: string; beats: Beat[] }
  /** Drop the outline to build the story from scratch, with no expected number of beats. The tree is kept. */
  | { type: "clearOutline" }
  /** The AI-tidied idea for the Plot reminder, and the idea text it was made from. */
  | { type: "setPlotSummary"; from: string; text: string }
  /** Rewrite one beat of the outline. The tree is left as it is. */
  | { type: "updateBeat"; index: number; patch: Partial<Beat> }
  /** Move a beat to another place in the outline. The tree is left as it is. */
  | { type: "moveBeat"; from: number; to: number }
  /** Add suggestions under one parent, keeping any already there. */
  | { type: "addCandidates"; key: string; candidates: Candidate[] }
  | { type: "addNode"; node: PlotNode }
  | { type: "updateNode"; id: string; patch: Partial<Pick<PlotNode, "title" | "summary" | "isEnding">> }
  /** Delete a node and everything below it. */
  | { type: "pruneNode"; id: string }
  | { type: "startBPlot"; premise: string }
  | { type: "setBPremise"; premise: string }
  /** Remove the B plot with its nodes, suggestions and links. */
  | { type: "removeBPlot" }
  | { type: "addLink"; link: Link }
  | { type: "removeLink"; link: Link }
  | { type: "setActiveLeaf"; plot: Plot; id: string | null }
  /**
   * Save what the editor holds. `owned` are the section keys the editor was
   * showing: they are replaced by `sections` (an owned key that is absent has
   * lost its heading). All other writing, including other branches', is kept.
   */
  | {
      type: "saveWriting";
      /** The project the editor was showing; a save that arrives after another was opened is dropped. */
      projectId: string;
      owned: string[];
      intro: JSONContent[];
      sections: Record<string, JSONContent[]>;
    };

function withoutNodes(project: Project, removed: Set<string>): Project {
  const candidates = { ...project.candidates };
  for (const node of project.nodes) {
    if (removed.has(node.id)) delete candidates[groupKey(node.plot, node.id)];
  }
  const activeLeaf = { ...project.activeLeaf };
  for (const plot of ["main", "b"] as const) {
    if (activeLeaf[plot] && removed.has(activeLeaf[plot])) activeLeaf[plot] = null;
  }
  return {
    ...project,
    nodes: project.nodes.filter((n) => !removed.has(n.id)),
    candidates,
    links: project.links.filter((l) => !removed.has(l.mainId) && !removed.has(l.bId)),
    activeLeaf,
  };
}

export function reducer(project: Project, action: Action): Project {
  switch (action.type) {
    case "hydrate":
      return action.project;
    case "setStep":
      return { ...project, step: action.step };
    case "setIdea":
      return { ...project, idea: action.idea };
    case "setPacing":
      return { ...project, pacing: Math.max(0, Math.min(100, Math.round(action.pacing))) };
    case "setTitle":
      return { ...project, title: action.title };
    case "setGuideRail":
      return {
        ...project,
        title: action.title,
        guideRail: action.beats,
        nodes: [],
        candidates: {},
        links: [],
        bPlot: null,
        activeLeaf: { main: null, b: null },
      };
    case "clearOutline":
      return { ...project, guideRail: [] };
    case "setPlotSummary":
      return { ...project, plotSummary: { from: action.from, text: action.text } };
    case "updateBeat":
      return {
        ...project,
        guideRail: project.guideRail.map((beat, i) => (i === action.index ? { ...beat, ...action.patch } : beat)),
      };
    case "moveBeat": {
      const { from, to } = action;
      const last = project.guideRail.length - 1;
      if (from === to || from < 0 || to < 0 || from > last || to > last) return project;
      const guideRail = project.guideRail.slice();
      const [moved] = guideRail.splice(from, 1);
      guideRail.splice(to, 0, moved);
      return { ...project, guideRail };
    }
    case "addCandidates": {
      const existing = project.candidates[action.key] ?? [];
      return {
        ...project,
        candidates: { ...project.candidates, [action.key]: [...existing, ...action.candidates] },
      };
    }
    case "addNode":
      if (project.nodes.some((n) => n.id === action.node.id)) return project;
      return {
        ...project,
        nodes: [
          ...project.nodes,
          { ...action.node, branch: branchFor(project.nodes, action.node.parentId, action.node.id) },
        ],
      };
    case "updateNode":
      return {
        ...project,
        nodes: project.nodes.map((n) => (n.id === action.id ? { ...n, ...action.patch } : n)),
      };
    case "pruneNode":
      return withoutNodes(project, new Set(subtreeIds(project.nodes, action.id)));
    case "startBPlot":
      return { ...project, bPlot: { premise: action.premise } };
    case "setBPremise":
      return project.bPlot ? { ...project, bPlot: { premise: action.premise } } : project;
    case "removeBPlot": {
      const removed = new Set(project.nodes.filter((n) => n.plot === "b").map((n) => n.id));
      const next = withoutNodes(project, removed);
      const candidates = { ...next.candidates };
      delete candidates[groupKey("b", null)];
      return { ...next, candidates, bPlot: null };
    }
    case "addLink":
      if (project.links.some((l) => l.mainId === action.link.mainId && l.bId === action.link.bId)) {
        return project;
      }
      return { ...project, links: [...project.links, action.link] };
    case "removeLink":
      return {
        ...project,
        links: project.links.filter(
          (l) => !(l.mainId === action.link.mainId && l.bId === action.link.bId),
        ),
      };
    case "setActiveLeaf":
      return { ...project, activeLeaf: { ...project.activeLeaf, [action.plot]: action.id } };
    case "saveWriting": {
      if (action.projectId !== project.id) return project;
      const owned = new Set(action.owned);
      const kept = Object.fromEntries(Object.entries(project.sections).filter(([id]) => !owned.has(id)));
      return { ...project, intro: action.intro, sections: { ...kept, ...action.sections } };
    }
  }
}

/** The current project, loaded from and saved to the browser. */
export function useProject() {
  const [project, dispatch] = useReducer(reducer, null, emptyProject);
  // False until the saved project has been read, so the first render matches the server's.
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const saved = loadProject();
    if (saved) dispatch({ type: "hydrate", project: saved });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveFailed(!saveProject(project));
  }, [project, hydrated]);

  return { project, dispatch, hydrated, saveFailed };
}
