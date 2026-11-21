"use client";

import { useEffect, useReducer, useState } from "react";
import { clampValue, defaultAttributes } from "./attributes";
import { DEFAULT_LENGTH } from "./length";
import { emptyProject, loadProject, saveProject } from "./storage";
import type { Alternate, Cell, Project, Step } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankCell(): Cell {
  return {
    id: newId(),
    heading: "",
    intent: "",
    mood: "neutral",
    started: true,
    text: "",
    alternates: [],
  };
}

export type Action =
  | { type: "hydrate"; project: Project }
  | { type: "reset" }
  | { type: "setStep"; step: Step }
  | { type: "setIdea"; idea: string }
  | { type: "setAttribute"; id: string; value: number }
  | { type: "setLength"; length: number }
  /** Put the pentagon and the length back to their defaults. */
  | { type: "resetStyle" }
  /** Replace the whole outline, as after generating one. */
  | { type: "setOutline"; title: string; cells: Cell[] }
  | { type: "setTitle"; title: string }
  | {
      type: "updateCell";
      id: string;
      patch: Partial<Pick<Cell, "heading" | "intent" | "mood" | "started" | "text">>;
    }
  | { type: "insertCell"; cell: Cell; afterId: string | null }
  | { type: "deleteCell"; id: string }
  | { type: "moveCell"; activeId: string; overId: string }
  | { type: "addAlternate"; cellId: string; alternate: Alternate }
  | { type: "updateAlternate"; cellId: string; alternateId: string; text: string }
  | { type: "deleteAlternate"; cellId: string; alternateId: string }
  /** Interchange the cell's paragraph with one of its alternates. */
  | { type: "swapAlternate"; cellId: string; alternateId: string }
  /** Drop alternates left empty, as when a rabbit hole closes. */
  | { type: "pruneAlternates"; cellId: string };

function mapCell(project: Project, id: string, fn: (cell: Cell) => Cell): Project {
  return { ...project, cells: project.cells.map((c) => (c.id === id ? fn(c) : c)) };
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function reducer(project: Project, action: Action): Project {
  switch (action.type) {
    case "hydrate":
      return action.project;
    case "reset":
      return emptyProject();
    case "setStep":
      return { ...project, step: action.step };
    case "setIdea":
      return { ...project, idea: action.idea };
    case "setAttribute":
      return {
        ...project,
        attributes: project.attributes.map((a) =>
          a.id === action.id ? { ...a, value: clampValue(action.value) } : a,
        ),
      };
    case "setLength":
      return { ...project, length: clampValue(action.length) };
    case "resetStyle":
      return { ...project, attributes: defaultAttributes(), length: DEFAULT_LENGTH };
    case "setOutline":
      return { ...project, title: action.title, cells: action.cells };
    case "setTitle":
      return { ...project, title: action.title };
    case "updateCell":
      return mapCell(project, action.id, (c) => ({ ...c, ...action.patch }));
    case "insertCell": {
      const index = action.afterId ? project.cells.findIndex((c) => c.id === action.afterId) : -1;
      const cells = project.cells.slice();
      cells.splice(index === -1 ? cells.length : index + 1, 0, action.cell);
      return { ...project, cells };
    }
    case "deleteCell":
      return { ...project, cells: project.cells.filter((c) => c.id !== action.id) };
    case "moveCell": {
      const from = project.cells.findIndex((c) => c.id === action.activeId);
      const to = project.cells.findIndex((c) => c.id === action.overId);
      return { ...project, cells: move(project.cells, from, to) };
    }
    case "addAlternate":
      return mapCell(project, action.cellId, (c) => ({
        ...c,
        alternates: [...c.alternates, action.alternate],
      }));
    case "updateAlternate":
      return mapCell(project, action.cellId, (c) => ({
        ...c,
        alternates: c.alternates.map((a) =>
          a.id === action.alternateId ? { ...a, text: action.text } : a,
        ),
      }));
    case "deleteAlternate":
      return mapCell(project, action.cellId, (c) => ({
        ...c,
        alternates: c.alternates.filter((a) => a.id !== action.alternateId),
      }));
    case "swapAlternate":
      return mapCell(project, action.cellId, (c) => {
        const chosen = c.alternates.find((a) => a.id === action.alternateId);
        if (!chosen) return c;
        return {
          ...c,
          text: chosen.text,
          alternates: c.alternates.map((a) => (a.id === chosen.id ? { ...a, text: c.text } : a)),
        };
      });
    case "pruneAlternates":
      return mapCell(project, action.cellId, (c) =>
        c.alternates.every((a) => a.text.trim())
          ? c
          : { ...c, alternates: c.alternates.filter((a) => a.text.trim()) },
      );
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
