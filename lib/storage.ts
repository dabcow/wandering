import { z } from "zod";
import { attributeSchema } from "./ai/schemas";
import { defaultAttributes } from "./attributes";
import { STEPS, type Project } from "./types";

const STORAGE_KEY = "wandering:project:v1";

const projectSchema = z.object({
  version: z.literal(1),
  step: z.enum(STEPS),
  idea: z.string(),
  attributes: z.array(attributeSchema).min(3),
  outline: z
    .object({
      title: z.string(),
      sections: z.array(z.object({ id: z.string(), heading: z.string(), intent: z.string() })),
    })
    .nullable(),
  cells: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      text: z.string(),
      history: z.array(z.string()),
    }),
  ),
});

export function emptyProject(): Project {
  return {
    version: 1,
    step: "idea",
    idea: "",
    attributes: defaultAttributes(),
    outline: null,
    cells: [],
  };
}

/** Returns the saved project, or null if there is none or it is unreadable. */
export function loadProject(): Project | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = projectSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Returns false if the browser refused the write (private mode, quota). */
export function saveProject(project: Project): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}
