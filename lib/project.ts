"use client";

import { useEffect, useReducer, useState } from "react";
import { clampValue, defaultAttributes } from "./attributes";
import { emptyProject, loadProject, saveProject } from "./storage";
import type { Cell, Outline, OutlineSection, Project, Step } from "./types";

/** Cap on how many earlier versions a cell remembers. */
const MAX_HISTORY = 20;

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type Action =
  | { type: "hydrate"; project: Project }
  | { type: "reset" }
  | { type: "setStep"; step: Step }
  | { type: "setIdea"; idea: string }
  | { type: "setAttribute"; id: string; value: number }
  | { type: "resetAttributes" }
  | { type: "setOutline"; outline: Outline }
  | { type: "setTitle"; title: string }
  | { type: "updateSection"; id: string; patch: Partial<Omit<OutlineSection, "id">> }
  | { type: "addSection"; section: OutlineSection }
  | { type: "removeSection"; id: string }
  | { type: "moveSection"; id: string; direction: -1 | 1 }
  | { type: "setCells"; cells: Cell[] }
  | { type: "updateCell"; id: string; patch: Partial<Pick<Cell, "text" | "heading">> }
  | { type: "insertCell"; cell: Cell; afterId: string | null }
  | { type: "deleteCell"; id: string }
  | { type: "moveCell"; activeId: string; overId: string }
  /** Replace a cell's text, keeping the old text in its history. */
  | { type: "swapCellText"; id: string; text: string }
  /** Step back to the most recent history entry. */
  | { type: "undoCell"; id: string }
  /** Bring back a specific history entry; the current text takes its place in history. */
  | { type: "restoreCell"; id: string; index: number };

function mapCell(project: Project, id: string, fn: (cell: Cell) => Cell): Project {
  return { ...project, cells: project.cells.map((c) => (c.id === id ? fn(c) : c)) };
}

function mapSections(project: Project, fn: (sections: OutlineSection[]) => OutlineSection[]): Project {
  if (!project.outline) return project;
  return { ...project, outline: { ...project.outline, sections: fn(project.outline.sections) } };
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
    case "resetAttributes":
      return { ...project, attributes: defaultAttributes() };
    case "setOutline":
      return { ...project, outline: action.outline };
    case "setTitle":
      return {
        ...project,
        outline: { sections: [], ...project.outline, title: action.title },
      };
    case "updateSection":
      return mapSections(project, (sections) =>
        sections.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      );
    case "addSection":
      return mapSections(project, (sections) => [...sections, action.section]);
    case "removeSection":
      return mapSections(project, (sections) => sections.filter((s) => s.id !== action.id));
    case "moveSection":
      return mapSections(project, (sections) => {
        const from = sections.findIndex((s) => s.id === action.id);
        return move(sections, from, from + action.direction);
      });
    case "setCells":
      return { ...project, cells: action.cells };
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
    case "swapCellText":
      return mapCell(project, action.id, (c) =>
        c.text === action.text
          ? c
          : { ...c, text: action.text, history: [...c.history, c.text].slice(-MAX_HISTORY) },
      );
    case "undoCell":
      return mapCell(project, action.id, (c) =>
        c.history.length === 0
          ? c
          : { ...c, text: c.history[c.history.length - 1], history: c.history.slice(0, -1) },
      );
    case "restoreCell":
      return mapCell(project, action.id, (c) => {
        const restored = c.history[action.index];
        if (restored === undefined) return c;
        const history = c.history.filter((_, i) => i !== action.index);
        return { ...c, text: restored, history: [...history, c.text].slice(-MAX_HISTORY) };
      });
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
