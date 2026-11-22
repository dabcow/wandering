/**
 * Projects are kept in this browser's local storage: one entry per project,
 * plus a small index (the library) listing them and saying which is open.
 * Nothing leaves the browser.
 */
import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { countWords, mergeBranchWriting, splitDoc } from "./doc";
import { newId } from "./id";
import { assignBranches } from "./tree";
import { STEPS, type Project } from "./types";

const LIBRARY_KEY = "wandering:library:v1";
const projectKey = (id: string) => `wandering:project:v3:${id}`;
/** Before there was a library, the one project lived here. */
const SINGLE_PROJECT_KEY = "wandering:project:v3";
/** Earlier versions of the app were a different tool; only the idea text carries over. */
const OLD_STORAGE_KEYS = ["wandering:project:v2", "wandering:project:v1"];

export const DEFAULT_PACING = 50;

const plotSchema = z.enum(["main", "b"]);

const block = z.custom<JSONContent>((value) => typeof value === "object" && value !== null);

const projectSchema = z.object({
  version: z.literal(3),
  // Absent in stories saved before there could be more than one.
  id: z.string().min(1).optional(),
  step: z.enum(STEPS),
  idea: z.string(),
  pacing: z.number().min(0).max(100),
  title: z.string(),
  guideRail: z.array(z.object({ title: z.string(), description: z.string() })),
  // Absent in stories saved before the Plot reminder existed.
  plotSummary: z.object({ from: z.string(), text: z.string() }).nullable().default(null),
  nodes: z.array(
    z.object({
      id: z.string(),
      parentId: z.string().nullable(),
      level: z.number().int().min(1),
      title: z.string(),
      summary: z.string(),
      source: z.enum(["ai", "user"]),
      isEnding: z.boolean(),
      plot: plotSchema,
      // Absent in stories saved before each branch kept its own writing.
      branch: z.string().optional(),
    }),
  ),
  candidates: z.record(
    z.string(),
    z.array(z.object({ id: z.string(), title: z.string(), summary: z.string(), isEnding: z.boolean() })),
  ),
  links: z.array(z.object({ mainId: z.string(), bId: z.string() })),
  bPlot: z.object({ premise: z.string() }).nullable(),
  activeLeaf: z.object({ main: z.string().nullable(), b: z.string().nullable() }),
  intro: z.array(block).default([]),
  sections: z.record(z.string(), z.array(block)).default({}),
  // Before the writing was stored per plot point, it was one document.
  doc: block.nullable().optional(),
});

/** Bring a saved project up to the current shape. */
function upgrade(saved: z.infer<typeof projectSchema>): Project {
  const { doc, ...rest } = saved;
  const nodes = assignBranches(rest.nodes);
  const fromDoc = doc && rest.intro.length === 0 && Object.keys(rest.sections).length === 0 ? splitDoc(doc) : null;
  // Each plot point has one text. Writing kept per branch for a while is folded back into it.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { intro, sections } = mergeBranchWriting(
    fromDoc?.intro ?? rest.intro,
    fromDoc?.sections ?? rest.sections,
    (nodeId) => byId.get(nodeId)?.branch,
  );
  return { ...rest, id: rest.id ?? newId(), nodes, intro, sections };
}

/** A fresh, empty project with an id of its own. */
export function emptyProject(): Project {
  return {
    version: 3,
    id: newId(),
    step: "idea",
    idea: "",
    pacing: DEFAULT_PACING,
    title: "",
    guideRail: [],
    plotSummary: null,
    nodes: [],
    candidates: {},
    links: [],
    bPlot: null,
    activeLeaf: { main: null, b: null },
    intro: [],
    sections: {},
  };
}

/** A project from parsed JSON (browser storage or a downloaded file), or null if it is not one. */
export function parseProject(value: unknown): Project | null {
  const parsed = projectSchema.safeParse(value);
  return parsed.success ? upgrade(parsed.data) : null;
}

/** A file name for a downloaded copy of the project, from its title. */
export function projectFileName(project: Project): string {
  const slug = project.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "my-story"}.wandering.json`;
}

/** True when a project holds anything worth keeping. */
export function hasWork(project: Project): boolean {
  return (
    project.idea.trim().length > 0 ||
    project.guideRail.length > 0 ||
    project.intro.length > 0 ||
    Object.keys(project.sections).length > 0
  );
}

/* ---------- The library ---------- */

/** What the library lists about a project, without opening it. */
export type ProjectEntry = {
  id: string;
  title: string;
  createdAt: number;
  /** When its contents last changed. */
  updatedAt: number;
  /** Whether an idea has been typed, even if nothing has been built from it. */
  hasIdea: boolean;
  beats: number;
  plotPoints: number;
  words: number;
};

const librarySchema = z.object({
  currentId: z.string().nullable(),
  projects: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
      hasIdea: z.boolean().default(false),
      beats: z.number(),
      plotPoints: z.number(),
      words: z.number(),
    }),
  ),
});
type Library = z.infer<typeof librarySchema>;

function describe(project: Project, createdAt: number, updatedAt: number): ProjectEntry {
  return {
    id: project.id,
    title: project.title,
    createdAt,
    updatedAt,
    hasIdea: project.idea.trim().length > 0,
    beats: project.guideRail.length,
    plotPoints: project.nodes.length,
    words:
      countWords(project.intro) +
      Object.values(project.sections).reduce((sum, blocks) => sum + countWords(blocks), 0),
  };
}

function writeLibrary(library: Library): void {
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

/** The library index. On first use it takes in the single project older versions kept. */
function readLibrary(): Library {
  const raw = window.localStorage.getItem(LIBRARY_KEY);
  if (raw) {
    const parsed = librarySchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  }

  const library: Library = { currentId: null, projects: [] };
  let first: Project | null = null;
  const single = window.localStorage.getItem(SINGLE_PROJECT_KEY);
  if (single) {
    first = parseProject(JSON.parse(single));
  } else {
    for (const key of OLD_STORAGE_KEYS) {
      const old = window.localStorage.getItem(key);
      if (!old) continue;
      const idea = (JSON.parse(old) as { idea?: unknown }).idea;
      if (typeof idea === "string" && idea.trim()) first = { ...emptyProject(), idea };
      break;
    }
  }
  if (first) {
    const now = Date.now();
    window.localStorage.setItem(projectKey(first.id), JSON.stringify(first));
    library.projects.push(describe(first, now, now));
    library.currentId = first.id;
  }
  writeLibrary(library);
  // Only once the project is safely in its new place.
  if (first) window.localStorage.removeItem(SINGLE_PROJECT_KEY);
  return library;
}

/** Every project in this browser, most recently changed first. */
export function listProjects(): ProjectEntry[] {
  try {
    return readLibrary()
      .projects.slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** One project from the library, or null if it is missing or unreadable. */
export function readProject(id: string): Project | null {
  try {
    const raw = window.localStorage.getItem(projectKey(id));
    const project = raw ? parseProject(JSON.parse(raw)) : null;
    // The entry's id wins, so a project can never be saved over another one.
    return project ? { ...project, id } : null;
  } catch {
    return null;
  }
}

/** The project that was open last, or null if there is none. */
export function loadProject(): Project | null {
  try {
    const { currentId } = readLibrary();
    return currentId ? readProject(currentId) : null;
  } catch {
    return null;
  }
}

/**
 * Save a project to the library and mark it as the open one. Returns false
 * if the browser refused the write (private mode, quota).
 */
export function saveProject(project: Project): boolean {
  try {
    const library = readLibrary();
    const raw = JSON.stringify(project);
    const key = projectKey(project.id);
    const changed = window.localStorage.getItem(key) !== raw;
    if (changed) window.localStorage.setItem(key, raw);

    const now = Date.now();
    const known = library.projects.find((p) => p.id === project.id);
    const entry = describe(project, known?.createdAt ?? now, changed || !known ? now : known.updatedAt);
    writeLibrary({
      currentId: project.id,
      projects: known
        ? library.projects.map((p) => (p.id === project.id ? entry : p))
        : [...library.projects, entry],
    });
    return true;
  } catch {
    return false;
  }
}

/** Remove a project from the library for good. */
export function deleteProject(id: string): void {
  try {
    const library = readLibrary();
    window.localStorage.removeItem(projectKey(id));
    writeLibrary({
      currentId: library.currentId === id ? null : library.currentId,
      projects: library.projects.filter((p) => p.id !== id),
    });
  } catch {
    // Nothing to remove, or storage is unavailable.
  }
}

/** Rename a project that is not the one open (the open one is renamed through the app's state). */
export function renameProject(id: string, title: string): void {
  try {
    const project = readProject(id);
    if (!project) return;
    const library = readLibrary();
    const renamed = { ...project, title };
    window.localStorage.setItem(projectKey(id), JSON.stringify(renamed));
    const known = library.projects.find((p) => p.id === id);
    const now = Date.now();
    writeLibrary({
      ...library,
      projects: library.projects.map((p) => (p.id === id ? describe(renamed, known?.createdAt ?? now, now) : p)),
    });
  } catch {
    // Storage is unavailable.
  }
}
